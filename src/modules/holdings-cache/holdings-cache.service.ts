import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Investor } from '../../entities/investor.entity';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class HoldingsCacheService implements OnModuleInit {
  private readonly logger = new Logger(HoldingsCacheService.name);
  private readonly BATCH_SIZE = 10;
  private readonly QUERY_TIMEOUT_MS = 600000; // 120 seconds
  private readonly MIN_BATCH_SIZE = 1; // floor for recursive splitting
  private redisClient: RedisClientType;

  constructor(
    @InjectRepository(Investor)
    private readonly investorRepo: Repository<Investor>,
  ) {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    });
    this.redisClient.on('error', (err) => this.logger.error('Redis Client Error', err));
  }

  async onModuleInit() {
    try {
      if (!this.redisClient.isOpen) await this.redisClient.connect();
      this.logger.log('Testing DIRECT Redis connection...');

      const cliVal = await this.redisClient.get('app-test-key');
      if (cliVal === 'found-in-redis') {
        this.logger.log('🚀 DIRECT Redis cross-check SUCCESS');
      } else {
        this.logger.warn(`⚠️ DIRECT Redis cross-check FAILED: got '${cliVal}'`);
      }

      await this.redisClient.setEx('test-key', 10, 'working');
      const val = await this.redisClient.get('test-key');
      this.logger.log(`✅ DIRECT Redis test: ${val === 'working' ? 'SUCCESS' : 'FAILED'}`);
    } catch (err) {
      this.logger.error('Failed to connect to Redis directly', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Cron — every 3 hours
  // ─────────────────────────────────────────────────────────────────────────
  @Cron('0 0 */3 * * *')
  async handleCron() {
    this.logger.log('Starting scheduled holdings cache refresh...');
    await this.refreshAllHoldings();
    this.logger.log('Scheduled holdings cache refresh completed.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Main refresh — processes all investors in batches, retries failed ones
  // ─────────────────────────────────────────────────────────────────────────
  async refreshAllHoldings() {
    try {
      const rawInvestors = await this.investorRepo
        .createQueryBuilder('investor')
        .select('investor.id', 'id')
        .addSelect('investor.company_id', 'company_id')
        .where('investor.company_id IS NOT NULL')
        .getRawMany();

      // investorMeta: map of investor_id -> company_id
      const investorMeta = new Map<string, string>();
      rawInvestors.forEach(r => investorMeta.set(r.id, r.company_id));

      const investorIds: string[] = rawInvestors.map((r) => r.id);
      this.logger.log(`Found ${investorIds.length} investors to cache.`);

      // ── First pass: process all batches, collect failures ────────────────
      const failedBatches: string[][] = [];

      for (let i = 0; i < investorIds.length; i += this.BATCH_SIZE) {
        const batch = investorIds.slice(i, i + this.BATCH_SIZE);
        const batchNo = Math.floor(i / this.BATCH_SIZE) + 1;
        this.logger.log(`Processing batch ${batchNo} (${batch.length} investors)`);

        const { failed } = await this.processBatchBothProviders(batch, investorMeta);

        if (failed.length > 0) {
          this.logger.warn(
            `Batch ${batchNo} had failures for providers: ${failed.join(', ')}. Will retry with smaller size.`,
          );
          failedBatches.push(batch);
        }

        await this.delay(500);
      }

      // ── Retry pass: split each failed batch in half and retry ────────────
      if (failedBatches.length > 0) {
        this.logger.log(
          `Retrying ${failedBatches.length} failed batch(es) with smaller sizes...`,
        );
        await this.retryFailedBatches(failedBatches, investorMeta);
      }

      this.logger.log('All batches processed.');
    } catch (error) {
      this.logger.error(`Error refreshing holdings cache: ${error.message}`, error.stack);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Retry failed batches — splits in half recursively down to MIN_BATCH_SIZE
  // ─────────────────────────────────────────────────────────────────────────
  private async retryFailedBatches(batches: string[][], investorMeta: Map<string, string>): Promise<void> {
    const stillFailed: string[][] = [];

    for (const batch of batches) {
      if (batch.length <= this.MIN_BATCH_SIZE) {
        // Already at minimum — log and skip; can't split further
        this.logger.error(
          `Batch of size ${batch.length} still failing at minimum batch size. ` +
          `Skipping investors: ${batch.join(', ')}`,
        );
        continue;
      }

      const half = Math.ceil(batch.length / 2);
      const subBatches = [batch.slice(0, half), batch.slice(half)];

      this.logger.log(
        `Retrying failed batch (size ${batch.length}) as 2 sub-batches of sizes ${subBatches.map((b) => b.length).join(' and ')}`,
      );

      for (const subBatch of subBatches) {
        this.logger.log(`  → Retrying sub-batch of ${subBatch.length} investors`);

        const { failed } = await this.processBatchBothProviders(subBatch, investorMeta);

        if (failed.length > 0) {
          this.logger.warn(
            `  → Sub-batch still failed for: ${failed.join(', ')}. Will split further.`,
          );
          stillFailed.push(subBatch);
        } else {
          this.logger.log(`  → Sub-batch of ${subBatch.length} succeeded.`);
        }

        await this.delay(500);
      }
    }

    // Recurse if there are still failures and we can still split
    if (stillFailed.length > 0) {
      const splittable = stillFailed.filter((b) => b.length > this.MIN_BATCH_SIZE);
      const unsplittable = stillFailed.filter((b) => b.length <= this.MIN_BATCH_SIZE);

      // Log permanently failed single investors
      unsplittable.forEach((b) => {
        this.logger.error(
          `Permanently failed at minimum batch size. Investor(s): ${b.join(', ')}`,
        );
      });

      if (splittable.length > 0) {
        await this.retryFailedBatches(splittable, investorMeta);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Run both CAMS and KARVY for a batch, return which providers failed
  // ─────────────────────────────────────────────────────────────────────────
  private async processBatchBothProviders(
    investorIds: string[],
    investorMeta: Map<string, string>
  ): Promise<{ failed: string[] }> {
    const failed: string[] = [];

    const results = await Promise.allSettled([
      this.refreshBatch(investorIds, 'CAMS', investorMeta),
      this.refreshBatch(investorIds, 'KARVY', investorMeta),
    ]);

    if (results[0].status === 'rejected') {
      this.logger.error(`CAMS failed: ${results[0].reason?.message}`);
      failed.push('CAMS');
    }
    if (results[1].status === 'rejected') {
      this.logger.error(`KARVY failed: ${results[1].reason?.message}`);
      failed.push('KARVY');
    }

    return { failed };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Refresh a single batch for one provider
  //  Throws on timeout or DB error so callers can detect failure
  // ─────────────────────────────────────────────────────────────────────────
  private async refreshBatch(
    investorIds: string[],
    provider: 'CAMS' | 'KARVY',
    investorMeta: Map<string, string>
  ): Promise<void> {
    const functionName =
      provider === 'CAMS'
        ? 'get_cams_investor_holdings_report'
        : 'get_karvy_investor_holdings_report';
    const keyPrefix = provider === 'CAMS' ? 'holdings:cams' : 'holdings:karvy';

    const queryPromise = this.investorRepo.query(
      `SELECT * FROM ${functionName}($1::uuid[])`,
      [investorIds],
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Query Timeout after ${this.QUERY_TIMEOUT_MS}ms`)),
        this.QUERY_TIMEOUT_MS,
      ),
    );

    // Will throw on timeout — caught by processBatchBothProviders
    const rows = (await Promise.race([queryPromise, timeoutPromise])) as any[];

    // Group rows by investor_id
    const investorDataMap = new Map<string, any[]>();
    investorIds.forEach((id) => investorDataMap.set(id, [])); // ensure all investors get a cache entry

    rows.forEach((row) => {
      const bucket = investorDataMap.get(row.investor_id);
      if (bucket) bucket.push(row);
    });

    // Write to Redis
    if (!this.redisClient.isOpen) await this.redisClient.connect();

    await Promise.all(
      Array.from(investorDataMap.entries()).map(async ([id, data]) => {
        try {
          const companyId = investorMeta.get(id);
          if (!companyId) return;

          await this.redisClient.set(
            `company:${companyId}:holdings:${provider.toLowerCase()}:${id}`,
            JSON.stringify(data),
          );
        } catch (e) {
          this.logger.error(`Redis write failed for investor ${id}: ${e.message}`);
        }
      }),
    );

    this.logger.log(
      `✅ ${provider}: cached ${investorDataMap.size} investors (batch size ${investorIds.length})`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Utility
  // ─────────────────────────────────────────────────────────────────────────
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  All read methods below are unchanged
  // ─────────────────────────────────────────────────────────────────────────

  async getSummaryByCompany(companyId: string) {
    try {
      if (!this.redisClient.isOpen) await this.redisClient.connect();

      const rawInvestors = await this.investorRepo
        .createQueryBuilder('investor')
        .select('DISTINCT investor.id', 'id')
        .where('investor.company_id = :companyId', { companyId })
        .getRawMany();

      const investorIds = rawInvestors.map((r) => r.id);
      if (investorIds.length === 0) return { total_invested: 0, total_current: 0, investor_count: 0 };

      const keys = investorIds.flatMap((id) => [
        `company:${companyId}:holdings:cams:${id}`,
        `company:${companyId}:holdings:karvy:${id}`
      ]);
      const results = await this.redisClient.mGet(keys);

      let totalInvested = 0;
      let totalCurrent = 0;

      results.forEach((val) => {
        if (!val) return;
        try {
          const data = JSON.parse(val);
          if (Array.isArray(data)) {
            data.forEach((h) => {
              totalInvested += parseFloat(h.invested_amount || 0);
              totalCurrent += parseFloat(h.current_value || 0);
            });
          }
        } catch (e) {
          this.logger.error(`Error parsing Redis JSON for summary: ${e.message}`);
        }
      });

      return {
        total_invested: parseFloat(totalInvested.toFixed(2)),
        total_current: parseFloat(totalCurrent.toFixed(2)),
        investor_count: investorIds.length,
      };
    } catch (error) {
      this.logger.error(`Error calculating company summary: ${error.message}`);
      throw error;
    }
  }

  async getTopContributingClients(companyId: string) {
    try {
      if (!this.redisClient.isOpen) await this.redisClient.connect();

      const investors = await this.investorRepo.find({
        where: { company_id: companyId },
        select: ['id', 'name', 'pan'],
      });

      if (investors.length === 0) return [];

      const keys = investors.flatMap((inv) => [
        `company:${companyId}:holdings:cams:${inv.id}`,
        `company:${companyId}:holdings:karvy:${inv.id}`,
      ]);

      const results = await this.redisClient.mGet(keys);

      const investorAumMap = new Map<string, { id: string; name: string; pan: string; total_current: number; total_invested: number }>();

      investors.forEach((inv, index) => {
        let totalCurrent = 0;
        let totalInvested = 0;

        [results[index * 2], results[index * 2 + 1]].forEach((val) => {
          if (!val) return;
          try {
            const data = JSON.parse(val);
            if (Array.isArray(data)) {
              data.forEach((h) => {
                totalCurrent += parseFloat(h.current_value || 0);
                totalInvested += parseFloat(h.invested_amount || 0);
              });
            }
          } catch (_) { }
        });

        if (totalCurrent > 0 || totalInvested > 0) {
          const existing = investorAumMap.get(inv.pan);
          if (existing) {
            existing.total_current += totalCurrent;
            existing.total_invested += totalInvested;
          } else {
            investorAumMap.set(inv.pan, {
              id: inv.id,
              name: inv.name || 'Unknown',
              pan: inv.pan,
              total_current: totalCurrent,
              total_invested: totalInvested,
            });
          }
        }
      });

      return Array.from(investorAumMap.values())
        .sort((a, b) => b.total_current - a.total_current)
        .slice(0, 10)
        .map((item) => {
          const pl = item.total_current - item.total_invested;
          const abs_pct = item.total_invested > 0 ? (pl / item.total_invested) * 100 : 0;
          return {
            id: item.id,
            name: item.name,
            pan: item.pan,
            total_current: parseFloat(item.total_current.toFixed(2)),
            total_invested: parseFloat(item.total_invested.toFixed(2)),
            notional_pl: parseFloat(pl.toFixed(2)),
            abs_pct: parseFloat(abs_pct.toFixed(2)),
          };
        });
    } catch (error) {
      this.logger.error(`Error calculating top contributors: ${error.message}`);
      throw error;
    }
  }

  async getCompanyInvestorsList(companyId: string, page: number = 1, limit: number = 10, search?: string) {
    try {
      const skip = (page - 1) * limit;
      if (!this.redisClient.isOpen) await this.redisClient.connect();

      let where: any = { company_id: companyId };
      if (search) {
        where = [
          { company_id: companyId, name: ILike(`%${search}%`) },
          { company_id: companyId, pan: ILike(`%${search}%`) },
        ];
      }

      const [investors, total] = await this.investorRepo.findAndCount({
        where,
        select: ['id', 'name', 'tax_status', 'tax_status_label', 'pan', 'email', 'username', 'date_of_birth'],
        skip,
        take: limit,
        order: { name: 'ASC' },
      });

      if (investors.length === 0) return { data: [], total };

      const keys = investors.flatMap((inv) => [
        `company:${companyId}:holdings:cams:${inv.id}`,
        `company:${companyId}:holdings:karvy:${inv.id}`,
      ]);

      const results = await this.redisClient.mGet(keys);

      const data = investors.map((inv, index) => {
        let totalAum = 0;

        [results[index * 2], results[index * 2 + 1]].forEach((val) => {
          if (!val) return;
          try {
            const holdings = JSON.parse(val);
            if (Array.isArray(holdings)) {
              holdings.forEach((h) => { totalAum += parseFloat(h.current_value || 0); });
            }
          } catch (_) { }
        });

        return {
          id: inv.id,
          name: inv.name || 'Unknown',
          tax_status: inv.tax_status_label || inv.tax_status || 'N/A',
          pan: inv.pan,
          email: inv.email || 'N/A',
          login_identifier: inv.username || 'N/A',
          date_of_birth: inv.date_of_birth,
          total_aum: parseFloat(totalAum.toFixed(2)),
        };
      });

      return { data, total };
    } catch (error) {
      this.logger.error(`Error calculating company investors list: ${error.message}`);
      throw error;
    }
  }

  async getInvestorHoldings(companyId: string, investorId: string) {
    try {
      const investor = await this.investorRepo.findOne({
        where: { id: investorId, company_id: companyId },
        select: ['id', 'name', 'pan'],
      });

      if (!investor) throw new Error('Investor not found or not associated with your company');

      if (!this.redisClient.isOpen) await this.redisClient.connect();

      const [camsData, karvyData] = await Promise.all([
        this.redisClient.get(`company:${companyId}:holdings:cams:${investorId}`),
        this.redisClient.get(`company:${companyId}:holdings:karvy:${investorId}`),
      ]);

      return {
        investor: { id: investor.id, name: investor.name, pan: investor.pan },
        holdings: {
          cams: camsData ? JSON.parse(camsData) : [],
          karvy: karvyData ? JSON.parse(karvyData) : [],
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching investor holdings: ${error.message}`);
      throw error;
    }
  }
}