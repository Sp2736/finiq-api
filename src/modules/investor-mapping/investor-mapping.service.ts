import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import {
  InvestorMappingHistory,
  MappingAction,
} from 'src/entities/investor-mapping-history.entity';
import { Investor } from 'src/entities/investor.entity';
import { SubBroker } from 'src/entities/sub-broker.entity';
import { UserProfile, UserRole } from 'src/entities/user-profile.entity';
import {
  AssignInvestorsDto,
  UnassignInvestorsDto,
} from './dto/investor-mapping.dto';
import { logAndSanitize } from 'src/common/utils/safe-error';

interface AccessContext {
  companyId: string;
  performedById: string;
  // null = unrestricted (COMPANY_ADMIN); otherwise the exact set of sub_broker ids
  // (self + all descendants) the caller is allowed to assign/unassign/view.
  allowedSubBrokerIds: string[] | null;
}

@Injectable()
export class InvestorMappingService {
  private readonly logger = new Logger(InvestorMappingService.name);

  constructor(
    @InjectRepository(InvestorMapping)
    private readonly mappingRepo: Repository<InvestorMapping>,
    @InjectRepository(InvestorMappingHistory)
    private readonly historyRepo: Repository<InvestorMappingHistory>,
    @InjectRepository(Investor)
    private readonly investorRepo: Repository<Investor>,
    @InjectRepository(SubBroker)
    private readonly subBrokerRepo: Repository<SubBroker>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // ACCESS RESOLUTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolves the caller's company_id, performedById (user_profile id used for
   * history logging), and the set of sub_broker ids they're allowed to touch.
   *
   *  - COMPANY_ADMIN → allowedSubBrokerIds = null (unrestricted within their company)
   *  - BROKER        → self + all descendants (their whole downline)
   *  - SUB_BROKER     → self + all descendants (their own downline, if any)
   *  - anything else  → throws ForbiddenException
   */
  private async resolveAccess(userPayload: any): Promise<AccessContext> {
    const roles: any[] = userPayload?.roles || [];

    const adminRole = roles.find((r) => r.role === UserRole.COMPANY_ADMIN);
    if (adminRole) {
      if (!adminRole.company_id)
        throw new BadRequestException('Invalid Company Admin context');
      return {
        companyId: adminRole.company_id,
        performedById: adminRole.id,
        allowedSubBrokerIds: null,
      };
    }

    const brokerRole = roles.find(
      (r) => r.role === UserRole.BROKER || r.role === UserRole.SUB_BROKER,
    );
    if (brokerRole) {
      if (!brokerRole.company_id)
        throw new BadRequestException('Invalid broker context');
      if (!brokerRole.sub_broker_id) {
        // JWT predates the sub_broker_id claim, or this account has no linked
        // SubBroker row at all — fail closed, not open.
        throw new ForbiddenException(
          'Your account is not linked to a broker record. Please log out and log back in; ' +
            'if the issue persists, contact your administrator.',
        );
      }
      const descendantIds = await this.getDescendantSubBrokerIds(
        brokerRole.sub_broker_id,
      );
      return {
        companyId: brokerRole.company_id,
        performedById: brokerRole.id,
        allowedSubBrokerIds: [brokerRole.sub_broker_id, ...descendantIds],
      };
    }

    throw new ForbiddenException(
      'You do not have permission to access Investor Mapping.',
    );
  }

  /** BFS over parent_id within the company; also usable via the `path` column for a
   *  single indexed query — using BFS here for parity with the existing
   *  UserManagementService.getDescendantBrokerIds() approach used elsewhere in the codebase. */
  private async getDescendantSubBrokerIds(rootId: string): Promise<string[]> {
    const all = await this.subBrokerRepo.find({ select: ['id', 'parent_id'] });
    const ids: string[] = [];
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      const children = all.filter((b) => b.parent_id === current);
      for (const child of children) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }
    return ids;
  }

  private assertSubBrokerAllowed(access: AccessContext, subBrokerId: string) {
    if (access.allowedSubBrokerIds === null) return; // COMPANY_ADMIN, unrestricted
    if (!access.allowedSubBrokerIds.includes(subBrokerId)) {
      throw new ForbiddenException(
        'You do not have permission to manage investors for this broker.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // READ — listing endpoints (NEW)
  // ─────────────────────────────────────────────────────────────

  /** Brokers/sub-brokers the caller is allowed to allot/remove investors for,
   *  used to populate the target-selection dropdown/tree in the UI. */
  async getAssignableBrokers(userPayload: any) {
    const access = await this.resolveAccess(userPayload);
    const where: any = { company_id: access.companyId };
    if (access.allowedSubBrokerIds !== null) {
      where.id = In(access.allowedSubBrokerIds);
    }
    const brokers = await this.subBrokerRepo.find({
      where,
      order: { name: 'ASC' },
    });
    return brokers.map((b) => ({
      id: b.id,
      name: b.name,
      arn_id: b.arn_id,
      parent_id: b.parent_id,
      is_distributor: !b.parent_id,
    }));
  }

  /** Investors in the company, annotated with their current active mapping (if any),
   *  filterable by mapped/unmapped and by a specific target sub_broker. */
  async getInvestors(
    userPayload: any,
    opts: {
      page: number;
      limit: number;
      search?: string;
      status?: 'all' | 'mapped' | 'unmapped';
      sub_broker_id?: string;
    },
  ) {
    const access = await this.resolveAccess(userPayload);

    const qb = this.investorRepo
      .createQueryBuilder('investor')
      .leftJoin(
        InvestorMapping,
        'mapping',
        'mapping.investor_id = investor.id AND mapping.is_active = true',
      )
      .leftJoin(SubBroker, 'broker', 'broker.id = mapping.sub_broker_id')
      .where('investor.company_id = :companyId', {
        companyId: access.companyId,
      });

    if (access.allowedSubBrokerIds !== null) {
      // A BROKER/SUB_BROKER may only see investors that are EITHER already mapped
      // somewhere within their own downline, OR completely unmapped (so they can
      // allot fresh investors to themselves/their downline). They must never see
      // investors that belong to a sibling/unrelated branch.
      qb.andWhere(
        '(mapping.sub_broker_id IN (:...allowed) OR mapping.id IS NULL)',
        {
          allowed: access.allowedSubBrokerIds,
        },
      );
    }

    if (opts.status === 'mapped') qb.andWhere('mapping.id IS NOT NULL');
    if (opts.status === 'unmapped') qb.andWhere('mapping.id IS NULL');
    if (opts.sub_broker_id)
      qb.andWhere('mapping.sub_broker_id = :sb', { sb: opts.sub_broker_id });
    if (opts.search?.trim()) {
      qb.andWhere(
        '(investor.investor_name ILIKE :s OR investor.pan_no ILIKE :s)',
        { s: `%${opts.search.trim()}%` },
      );
    }

    qb.select([
      'investor.id AS id',
      'investor.investor_name AS name',
      'investor.pan_no AS pan',
      'investor.email AS email',
      'investor.mobile_no AS mobile',
      'mapping.sub_broker_id AS current_sub_broker_id',
      'broker.name AS current_sub_broker_name',
    ]);

    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const total = await qb.getCount();
    const rows = await qb
      .orderBy('investor.investor_name', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Mapping history, scoped the same way as the investor listing. */
  async getHistory(
    userPayload: any,
    opts: { page: number; limit: number; sub_broker_id?: string },
  ) {
    const access = await this.resolveAccess(userPayload);

    const qb = this.historyRepo
      .createQueryBuilder('h')
      .leftJoin(Investor, 'investor', 'investor.id = h.investor_id')
      .leftJoin(SubBroker, 'broker', 'broker.id = h.sub_broker_id')
      .leftJoin(UserProfile, 'performer', 'performer.id = h.performed_by_id')
      .where('h.company_id = :companyId', { companyId: access.companyId });

    if (access.allowedSubBrokerIds !== null) {
      qb.andWhere('h.sub_broker_id IN (:...allowed)', {
        allowed: access.allowedSubBrokerIds,
      });
    }
    if (opts.sub_broker_id)
      qb.andWhere('h.sub_broker_id = :sb', { sb: opts.sub_broker_id });

    qb.select([
      'h.id AS id',
      'h.action AS action',
      'h.created_at AS created_at',
      'investor.investor_name AS investor_name',
      'investor.pan_no AS investor_pan',
      'broker.name AS sub_broker_name',
      "performer.first_name || ' ' || COALESCE(performer.last_name, '') AS performed_by_name",
    ]);

    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const total = await qb.getCount();
    const rows = await qb
      .orderBy('h.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // WRITE — assign / unassign (REWRITTEN for scoping)
  // ─────────────────────────────────────────────────────────────

  async assignInvestors(userPayload: any, dto: AssignInvestorsDto) {
    const access = await this.resolveAccess(userPayload);
    this.assertSubBrokerAllowed(access, dto.sub_broker_id);

    const targetBroker = await this.subBrokerRepo.findOne({
      where: { id: dto.sub_broker_id, company_id: access.companyId },
    });
    if (!targetBroker)
      throw new NotFoundException('Target broker not found in your company');

    const investors = await this.investorRepo.find({
      where: { id: In(dto.investor_ids), company_id: access.companyId },
    });
    if (investors.length !== dto.investor_ids.length) {
      throw new BadRequestException(
        'Some investors not found or do not belong to your company',
      );
    }

    // Non-admins may only reassign investors that are currently unmapped, or already
    // mapped somewhere inside their own downline — never "steal" an investor that
    // belongs to an unrelated branch of the company.
    if (access.allowedSubBrokerIds !== null) {
      const existing = await this.mappingRepo.find({
        where: { investor_id: In(dto.investor_ids), is_active: true },
      });
      const outOfScope = existing.filter(
        (m) => !access.allowedSubBrokerIds!.includes(m.sub_broker_id),
      );
      if (outOfScope.length > 0) {
        throw new ForbiddenException(
          'One or more selected investors are already mapped outside your downline.',
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const investor of investors) {
        await queryRunner.manager.update(
          InvestorMapping,
          { investor_id: investor.id, is_active: true },
          { is_active: false },
        );

        let mapping = await queryRunner.manager.findOne(InvestorMapping, {
          where: {
            investor_id: investor.id,
            sub_broker_id: targetBroker.id,
            company_id: access.companyId,
          },
        });
        if (mapping) {
          mapping.is_active = true;
          await queryRunner.manager.save(InvestorMapping, mapping);
        } else {
          mapping = new InvestorMapping();
          mapping.company_id = access.companyId;
          mapping.investor_id = investor.id;
          mapping.sub_broker_id = targetBroker.id;
          mapping.is_active = true;
          await queryRunner.manager.save(InvestorMapping, mapping);
        }
        await this.logHistory(
          queryRunner,
          access.companyId,
          investor.id,
          targetBroker.id,
          MappingAction.ASSIGNED,
          access.performedById,
        );
      }
      await queryRunner.commitTransaction();
      return { success: true, message: 'Investors assigned successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        logAndSanitize(
          this.logger,
          `Assignment failed for sub_broker ${dto.sub_broker_id}`,
          error,
          'Mapping failed. Please try again.',
        ),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async unassignInvestors(userPayload: any, dto: UnassignInvestorsDto) {
    const access = await this.resolveAccess(userPayload);
    this.assertSubBrokerAllowed(access, dto.sub_broker_id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const investorId of dto.investor_ids) {
        const mapping = await queryRunner.manager.findOne(InvestorMapping, {
          where: {
            investor_id: investorId,
            sub_broker_id: dto.sub_broker_id,
            company_id: access.companyId,
            is_active: true,
          },
        });
        if (mapping) {
          mapping.is_active = false;
          await queryRunner.manager.save(InvestorMapping, mapping);
          await this.logHistory(
            queryRunner,
            access.companyId,
            investorId,
            dto.sub_broker_id,
            MappingAction.UNASSIGNED,
            access.performedById,
          );
        }
      }
      await queryRunner.commitTransaction();
      return { success: true, message: 'Investors unassigned successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        logAndSanitize(
          this.logger,
          'Unassignment failed',
          error,
          'Unmapping failed. Please try again.',
        ),
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async logHistory(
    queryRunner,
    companyId,
    investorId,
    subBrokerId,
    action: MappingAction,
    performedById,
  ) {
    const history = new InvestorMappingHistory();
    history.company_id = companyId;
    history.investor_id = investorId;
    history.sub_broker_id = subBrokerId;
    history.action = action;
    history.performed_by_id = performedById;
    await queryRunner.manager.save(InvestorMappingHistory, history);
  }
}
