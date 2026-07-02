import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { BaseRepository, PaginationParams } from 'src/common';
import {
  CamsInvestorStaticDetail,
  NavHistory,
  CamsSchemeDetail,
  CamsInvestorTransaction,
  CamsSipStpDetail,
  Investor,
} from 'src/entities';

/**
 * Investor Repository - Handles all investor data operations
 */
@Injectable()
export class InvestorRepository extends BaseRepository<Investor> {
  protected readonly logger = new Logger(InvestorRepository.name);

  constructor(
    @InjectRepository(Investor)
    private investorRepo: Repository<Investor>,
    @InjectRepository(NavHistory)
    private navHistoryRepo: Repository<NavHistory>,
    @InjectRepository(CamsSchemeDetail)
    private schemeRepo: Repository<CamsSchemeDetail>,
    @InjectRepository(CamsInvestorTransaction)
    private transactionRepo: Repository<CamsInvestorTransaction>,
    @InjectRepository(CamsSipStpDetail)
    private sipStpRepo: Repository<CamsSipStpDetail>,
  ) {
    super(investorRepo);
  }

  /**
   * Override findAll to include mappings and sub-broker info
   */
  async findAll(
    pagination: PaginationParams,
    access?: any,
  ): Promise<[Investor[], number]> {
    try {
      const query = this.investorRepo
        .createQueryBuilder('investor')
        .leftJoinAndSelect(
          'investor.mappings',
          'mapping',
          'mapping.is_active = :isActive',
          { isActive: true },
        )
        .leftJoinAndSelect('mapping.sub_broker', 'sub_broker')
        .distinctOn(['investor.pan'])
        .orderBy('investor.pan', 'ASC')
        .addOrderBy('investor.created_at', 'DESC')
        .skip(pagination.skip || 0)
        .take(pagination.limit || 10);

      const countQuery = this.investorRepo
        .createQueryBuilder('investor')
        .leftJoin(
          'investor.mappings',
          'mapping',
          'mapping.is_active = :isActive',
          { isActive: true },
        )
        .select('COUNT(DISTINCT investor.pan)', 'count');

      // Tenant/Company boundary
      if (access && access.companyId) {
        query.andWhere('investor.company_id = :companyId', {
          companyId: access.companyId,
        });
        countQuery.andWhere('investor.company_id = :companyId', {
          companyId: access.companyId,
        });
      } else if (access && access.allowedCompanyIds) {
        query.andWhere('investor.company_id IN (:...allowedCompanyIds)', {
          allowedCompanyIds: access.allowedCompanyIds,
        });
        countQuery.andWhere('investor.company_id IN (:...allowedCompanyIds)', {
          allowedCompanyIds: access.allowedCompanyIds,
        });
      }

      // Hierarchy boundary
      if (access && access.allowedSubBrokerIds) {
        query.andWhere('mapping.sub_broker_id IN (:...allowedSubBrokerIds)', {
          allowedSubBrokerIds: access.allowedSubBrokerIds,
        });
        countQuery.andWhere(
          'mapping.sub_broker_id IN (:...allowedSubBrokerIds)',
          { allowedSubBrokerIds: access.allowedSubBrokerIds },
        );
      }

      const data = await query.getMany();
      const countResult = await countQuery.getRawOne();
      const count = countResult ? parseInt(countResult.count, 10) : 0;

      return [data, count];
    } catch (error) {
      this.logger.error(`Error finding investors: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find investor by folio number
   */
  async findByFolio(folio: string): Promise<Investor | null> {
    try {
      return await this.investorRepo.findOne({
        where: { foliochk: folio } as FindOptionsWhere<Investor>,
      });
    } catch (error) {
      this.logger.error(`Error finding investor by folio: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find investor by PAN
   */
  async findByPan(pan: string): Promise<Investor | null> {
    try {
      return await this.investorRepo.findOne({
        where: { pan: pan } as FindOptionsWhere<Investor>,
      });
    } catch (error) {
      this.logger.error(`Error finding investor by PAN: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search investors by email or username
   */
  async findByUsernameOrEmail(identifier: string): Promise<Investor | null> {
    return this.investorRepo.findOne({
      where: [{ username: identifier as any }, { email: identifier as any }],
    });
  }

  /**
   * Find investor by exact email
   */
  async findByEmail(email: string): Promise<Investor | null> {
    return this.investorRepo.findOne({
      where: { email: email as any },
    });
  }

  /**
   * Search investors by name, email, or mobile
   */
  async search(
    searchTerm: string,
    pagination: PaginationParams,
    access?: any,
  ): Promise<[Investor[], number]> {
    try {
      const query = this.investorRepo.createQueryBuilder('investor');
      const countQuery = this.investorRepo
        .createQueryBuilder('investor')
        .leftJoin(
          'investor.mappings',
          'mapping',
          'mapping.is_active = :isActive',
          { isActive: true },
        )
        .select('COUNT(DISTINCT investor.pan)', 'count');

      // Search condition
      const whereClause =
        '(investor.investor_name ILIKE :search OR ' +
        'investor.email ILIKE :search OR ' +
        'investor.mobile_no ILIKE :search OR ' +
        'investor.pan ILIKE :search)';
      const parameters = { search: `%${searchTerm}%` };

      query.where(whereClause, parameters);
      countQuery.where(whereClause, parameters);

      // Tenant/Company boundary
      if (access && access.companyId) {
        query.andWhere('investor.company_id = :companyId', {
          companyId: access.companyId,
        });
        countQuery.andWhere('investor.company_id = :companyId', {
          companyId: access.companyId,
        });
      } else if (access && access.allowedCompanyIds) {
        query.andWhere('investor.company_id IN (:...allowedCompanyIds)', {
          allowedCompanyIds: access.allowedCompanyIds,
        });
        countQuery.andWhere('investor.company_id IN (:...allowedCompanyIds)', {
          allowedCompanyIds: access.allowedCompanyIds,
        });
      }

      // Hierarchy boundary
      if (access && access.allowedSubBrokerIds) {
        query.andWhere('mapping.sub_broker_id IN (:...allowedSubBrokerIds)', {
          allowedSubBrokerIds: access.allowedSubBrokerIds,
        });
        countQuery.andWhere(
          'mapping.sub_broker_id IN (:...allowedSubBrokerIds)',
          { allowedSubBrokerIds: access.allowedSubBrokerIds },
        );
      }

      // Use DISTINCT ON to return unique investors by PAN
      // Order by PAN first, then by created_at DESC for latest record
      query
        .leftJoinAndSelect(
          'investor.mappings',
          'mapping',
          'mapping.is_active = :isActive',
          { isActive: true },
        )
        .leftJoinAndSelect('mapping.sub_broker', 'sub_broker')
        .distinctOn(['investor.pan'])
        .orderBy('investor.pan', 'ASC')
        .addOrderBy('investor.created_at', 'DESC')
        .skip(pagination.skip || 0)
        .take(pagination.limit || 10);

      // Execute data query
      const data = await query.getMany();

      // Execute count query separately
      const countResult = await countQuery.getRawOne();

      const count = countResult ? parseInt(countResult.count, 10) : 0;

      return [data, count];
    } catch (error) {
      this.logger.error(`Error searching investors: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the investor with the latest username (ordered alphabetically/numerically)
   */
  async findLatestUsername(): Promise<Investor | null> {
    try {
      const qb = this.investorRepo.createQueryBuilder('investor');
      qb.where('investor.username IS NOT NULL')
        .orderBy('LENGTH(investor.username)', 'DESC') // To handle Z99999 vs AA0001
        .addOrderBy('investor.username', 'DESC')
        .limit(1);
      return await qb.getOne();
    } catch (error) {
      this.logger.error(`Error finding latest username: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the latest address and static details for an investor
   */
  async getLatestAddress(investorId: string) {
    try {
      const investor = await this.investorRepo
        .createQueryBuilder('investor')
        .leftJoinAndSelect('investor.static_details', 'static_details')
        .where('investor.id = :investorId', { investorId })
        .orderBy('static_details.created_at', 'DESC')
        .getOne();

      return investor?.static_details?.[0] || null;
    } catch (error) {
      this.logger.error(
        `Error getting latest address for investor ${investorId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Save an investor
   */
  async save(investor: Investor): Promise<Investor> {
    return this.investorRepo.save(investor);
  }

  /**
   * Find investors by AMC code with pagination
   */
  async findByAmcCode(
    amcCode: string,
    pagination: PaginationParams,
  ): Promise<[Investor[], number]> {
    try {
      return this.investorRepo.findAndCount({
        where: { amc_code: amcCode } as FindOptionsWhere<Investor>,
        skip: pagination.skip || 0,
        take: pagination.limit || 10,
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Error finding investors by AMC code: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get investor count statistics
   */
  async getStats() {
    try {
      const total = await this.investorRepo.count();
      const activeInvestors = await this.investorRepo.count({
        where: { rupee_bal: 0 } as any, // approximation - investors with balance
      });

      return {
        total,
        active: activeInvestors,
      };
    } catch (error) {
      this.logger.error(`Error getting investor stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get investor holdings by investor ID - all schemes/investments
   * Only returns active holdings (where balance > 0)
   */
  // async getHoldings(investorId: string) {
  //   try {
  //     const investor = await this.investorRepo.findOne({
  //       where: { id: investorId },
  //     });

  //     if (!investor) {
  //       return null;
  //     }

  //     // Get all holdings for this investor by PAN (covers all folios and schemes)
  //     // Filter out closed positions (where rupee_bal = 0 or null)
  //     const holdings = await this.investorRepo.find({
  //       where: { pan_no: investor.pan_no },
  //     });

  //     // Filter to only active holdings (rupee_bal > 0 or clos_bal > 0)
  //     const activeHoldings = holdings.filter(
  //       (h) => (Number(h.rupee_bal) || 0) > 0 || (Number(h.clos_bal) || 0) > 0,
  //     );

  //     return activeHoldings;
  //   } catch (error) {
  //     this.logger.error(`Error getting holdings for investor ${investorId}: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * Get investor account balance by investor ID
   */
  // async getBalance(investorId: string) {
  //   try {
  //     const investor = await this.investorRepo.findOne({
  //       where: { id: investorId },
  //     });

  //     return investor || null;
  //   } catch (error) {
  //     this.logger.error(`Error getting balance for investor ${investorId}: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * Get folio status for investor - only active folios
   */
  // async getFolioStatus(investorId: string) {
  //   try {
  //     const investor = await this.investorRepo.findOne({
  //       where: { id: investorId },
  //     });

  //     if (!investor) {
  //       return null;
  //     }

  //     // Get all folios for this investor
  //     let folios = await this.investorRepo.find({
  //       where: { pan_no: investor.pan_no },
  //     });

  //     // Filter to only active folios (rupee_bal > 0 or clos_bal > 0)
  //     folios = folios.filter(
  //       (f) => (Number(f.rupee_bal) || 0) > 0 || (Number(f.clos_bal) || 0) > 0,
  //     );

  //     return folios;
  //   } catch (error) {
  //     this.logger.error(`Error getting folio status for investor ${investorId}: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * Get folio details by folio number
   */
  // async getFolioDetails(folioNumber: string) {
  //   try {
  //     const folios = await this.investorRepo.find({
  //       where: { foliochk: folioNumber },
  //     });

  //     return folios;
  //   } catch (error) {
  //     this.logger.error(`Error getting folio details for ${folioNumber}: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * Get latest NAV by ISIN
   */
  async getLatestNAV(isin: string) {
    try {
      const nav = await this.navHistoryRepo
        .createQueryBuilder('nav')
        .where('nav.isinPayoutGrowth = :isin OR nav.isinReinvestment = :isin', {
          isin,
        })
        .orderBy('nav.navDate', 'DESC')
        .limit(1)
        .getOne();

      return nav || null;
    } catch (error) {
      this.logger.error(
        `Error getting latest NAV for ISIN ${isin}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get ISIN by scheme code from cams_scheme_details table
   * Scheme code format varies - amc_codes can be multiple characters
   * Prefer scheme name lookup for accuracy
   */
  async getISINByScheme(schemeCode?: string | number, schemeName?: string) {
    try {
      let scheme: CamsSchemeDetail | null = null;

      // Primary: Look up by scheme name (most reliable)
      if (schemeName) {
        scheme = await this.schemeRepo.findOne({
          where: { sch_name: schemeName } as FindOptionsWhere<CamsSchemeDetail>,
        });

        if (scheme) {
          this.logger.debug(
            `ISIN found by scheme name "${schemeName}": ${scheme.isin_no}`,
          );
          return scheme.isin_no || null;
        }
      }

      // Fallback: Look up by scheme code pattern match
      if (schemeCode) {
        const schemeStr = String(schemeCode).toUpperCase();

        this.logger.debug(
          `No scheme found by name, trying to match scheme code: ${schemeStr}`,
        );

        // Query with LIKE pattern to find matching schemes
        // This handles variable-length amc_codes
        const schemes = await this.schemeRepo.find();

        // Try to find a scheme where the product code (amc_code + sch_code concatenated) matches
        for (const s of schemes) {
          const productCode = (s.amc_code || '') + (s.sch_code || '');
          if (productCode.toUpperCase() === schemeStr) {
            scheme = s;
            this.logger.debug(
              `Scheme code matched: ${schemeStr} -> AMC: ${s.amc_code}, Scheme: ${s.sch_code}`,
            );
            break;
          }
        }
      }

      if (!scheme || !scheme.isin_no) {
        this.logger.debug(
          `No scheme or ISIN found for code: ${schemeCode}, name: ${schemeName}`,
        );
        return null;
      }

      this.logger.debug(
        `ISIN found for scheme ${schemeCode}: ${scheme.isin_no}`,
      );
      return scheme.isin_no;
    } catch (error) {
      this.logger.error(`Error getting ISIN for scheme: ${error.message}`);
      return null;
    }
  }

  /**
   * Get NAV history for a scheme within a date range
   */
  async getNAVHistory(
    schemeCode: string | number,
    fromDate?: Date,
    toDate?: Date,
  ) {
    try {
      let query = this.navHistoryRepo
        .createQueryBuilder('nav')
        .where('nav.schemeCode = :schemeCode', {
          schemeCode: String(schemeCode),
        });

      if (fromDate) {
        query = query.andWhere('nav.navDate >= :fromDate', { fromDate });
      }

      if (toDate) {
        query = query.andWhere('nav.navDate <= :toDate', { toDate });
      }

      const navs = await query.orderBy('nav.navDate', 'ASC').getMany();
      return navs;
    } catch (error) {
      this.logger.error(
        `Error getting NAV history for scheme ${schemeCode}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get NAV history by ISIN for date range
   */
  async getNAVHistoryByISIN(isin: string, fromDate?: Date, toDate?: Date) {
    try {
      let query = this.navHistoryRepo
        .createQueryBuilder('nav')
        .where('nav.isinPayoutGrowth = :isin OR nav.isinReinvestment = :isin', {
          isin,
        });

      if (fromDate) {
        query = query.andWhere('nav.navDate >= :fromDate', { fromDate });
      }

      if (toDate) {
        query = query.andWhere('nav.navDate <= :toDate', { toDate });
      }

      const navs = await query.orderBy('nav.navDate', 'ASC').getMany();
      return navs;
    } catch (error) {
      this.logger.error(
        `Error getting NAV history by ISIN ${isin}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get 1-day NAV change percentage
   */
  async getOneDayNAVChange(isin: string): Promise<number | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get NAV data for last 5 days to find yesterday's data
      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const navs = await this.navHistoryRepo
        .createQueryBuilder('nav')
        .where(
          '(nav.isinPayoutGrowth = :isin OR nav.isinReinvestment = :isin)',
          { isin },
        )
        .andWhere('nav.navDate >= :fiveDaysAgo', { fiveDaysAgo })
        .orderBy('nav.navDate', 'DESC')
        .getMany();

      if (navs.length === 0) {
        this.logger.debug(`No NAV data found for ISIN ${isin}`);
        return null;
      }

      // Find today's NAV and previous day's NAV
      let todayNav: number | null = null;
      let yesterdayNav: number | null = null;

      for (let i = 0; i < navs.length; i++) {
        const navDate = new Date(navs[i].navDate);
        navDate.setHours(0, 0, 0, 0);

        if (navDate.getTime() === today.getTime() && !todayNav) {
          todayNav = Number(navs[i].nav);
        } else if (navDate < today && !yesterdayNav) {
          yesterdayNav = Number(navs[i].nav);
          break;
        }
      }

      if (!todayNav || !yesterdayNav) {
        this.logger.debug(
          `Insufficient NAV data for 1-day change. Today: ${todayNav}, Yesterday: ${yesterdayNav}`,
        );
        return null;
      }

      const change = ((todayNav - yesterdayNav) / yesterdayNav) * 100;
      const result = Number(change.toFixed(4));
      this.logger.debug(
        `1-day NAV change for ISIN ${isin}: ${result}% (Today: ${todayNav}, Yesterday: ${yesterdayNav})`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error calculating 1-day NAV change for ISIN ${isin}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get investment type (SIP/LUMPSUM/MIXED) and SIP status for a scheme holding
   */
  /**
   * Get investment type (SIP/LUMPSUM/MIXED) and SIP status for a scheme holding
   * Matches SIP/STP records with transactions using transaction numbers and product codes
   */
  async getInvestmentTypeAndSIPStatus(
    folio: string,
    amcCode?: string,
  ): Promise<{ investment_type: string; sip_status: string }> {
    try {
      let investmentType = 'LUMPSUM';
      let sipStatus = 'N/A';
      let hasSipForScheme = false;

      // First, find all transactions for this folio
      const whereClause: any = { folio_no: folio };
      if (amcCode) {
        whereClause.amc_code = amcCode;
      }

      const transactions = await this.transactionRepo.find({
        where: whereClause as any,
      });

      this.logger.debug(
        `Found ${transactions.length} transactions for folio ${folio}, amc_code="${amcCode}"`,
      );

      if (transactions && transactions.length > 0) {
        // Extract all unique product codes from transactions
        const productCodes = new Set(
          transactions.map((t) => t.prodcode).filter(Boolean),
        );

        // Extract all SIP transaction numbers from transactions
        const sipTransactionNumbers = new Set(
          transactions.map((t) => t.siptrxnno).filter(Boolean),
        );

        this.logger.debug(
          `Product codes: ${Array.from(productCodes).join(', ')}, SIP TRXNNOs: ${Array.from(sipTransactionNumbers).join(', ')}`,
        );

        // Find SIP/STP records for this folio
        const sipStpRecords = await this.sipStpRepo.find({
          where: { folio_no: folio } as any,
        });

        this.logger.debug(
          `Found ${sipStpRecords.length} SIP/STP records for folio ${folio}`,
        );

        // Try to match SIP/STP records
        for (const sip of sipStpRecords) {
          let isMatch = false;

          // Strategy 1: Match by auto_trno (SIP transaction number)
          if (sip.auto_trno && sipTransactionNumbers.has(sip.auto_trno)) {
            isMatch = true;
            this.logger.debug(
              `Matched SIP/STP by auto_trno: "${sip.auto_trno}"`,
            );
          }

          // Strategy 2: Match by product code (amc_code + scheme_code)
          if (!isMatch && sip.amc_code && sip.scheme_code) {
            const sipProductCode = `${sip.amc_code}${sip.scheme_code}`;
            if (productCodes.has(sipProductCode)) {
              isMatch = true;
              this.logger.debug(
                `Matched SIP/STP by product code: "${sipProductCode}"`,
              );
            }
          }

          // Strategy 3: Match by amc_code and scheme name (fallback)
          if (!isMatch && sip.amc_code === amcCode && sip.scheme) {
            const matchedTx = transactions.find(
              (t) =>
                t.scheme &&
                t.scheme.toLowerCase().includes(sip.scheme.toLowerCase()),
            );
            if (matchedTx) {
              isMatch = true;
              this.logger.debug(
                `Matched SIP/STP by amc_code and scheme name: "${sip.scheme}"`,
              );
            }
          }

          if (isMatch) {
            hasSipForScheme = true;
            investmentType = 'SIP';

            // Check the transaction type - SIP or STP
            if (sip.aut_trntyp) {
              const auTrnType = sip.aut_trntyp.toUpperCase();
              this.logger.debug(`aut_trntyp for matched SIP: ${auTrnType}`);
              if (auTrnType.includes('R')) {
                // R = STP (Systematic Transfer Plan)
                investmentType = 'STP';
              }
              // P = SIP (Systematic Investment Plan) or Purchase
            }

            // Determine SIP status based on dates
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (sip.cease_date) {
              const ceaseDate = new Date(sip.cease_date);
              ceaseDate.setHours(0, 0, 0, 0);
              if (ceaseDate < today) {
                sipStatus = 'TERMINATED';
              } else if (sip.to_date) {
                const toDate = new Date(sip.to_date);
                toDate.setHours(0, 0, 0, 0);
                sipStatus =
                  toDate < today
                    ? 'EXPIRED'
                    : this.determineSipActiveStatus(sip, today);
              } else {
                sipStatus = this.determineSipActiveStatus(sip, today);
              }
            } else if (sip.to_date) {
              const toDate = new Date(sip.to_date);
              toDate.setHours(0, 0, 0, 0);
              sipStatus =
                toDate < today
                  ? 'EXPIRED'
                  : this.determineSipActiveStatus(sip, today);
            } else if (sip.from_date) {
              sipStatus = this.determineSipActiveStatus(sip, today);
            }
            break;
          }
        }
      }

      // If we found transactions but no SIP, it's pure LUMPSUM
      if (!hasSipForScheme && transactions.length > 0) {
        investmentType = 'LUMPSUM';
        sipStatus = 'N/A';
      }
      // If we found SIP AND more than one transaction, it might be MIXED
      else if (hasSipForScheme && transactions.length > 1) {
        // Check if there are multiple types of transactions (SIP and lumpsum)
        const hasSIPTransaction = transactions.some((t) => t.siptrxnno);
        const hasLumpSumTransaction = transactions.some(
          (t) =>
            !t.siptrxnno &&
            (t.trxntype === 'BUY' ||
              t.trxntype === 'SIP' ||
              t.trxntype === 'LUMPSUM'),
        );

        if (hasSIPTransaction && hasLumpSumTransaction) {
          investmentType = investmentType === 'STP' ? 'STP/MIXED' : 'SIP/MIXED';
        }
      }

      this.logger.debug(
        `Investment type for folio ${folio}, amc_code ${amcCode}: ${investmentType}, status: ${sipStatus}`,
      );

      return { investment_type: investmentType, sip_status: sipStatus };
    } catch (error) {
      this.logger.error(
        `Error getting investment type for folio ${folio}: ${error.message}`,
      );
      return { investment_type: 'UNKNOWN', sip_status: 'N/A' };
    }
  }

  /**
   * Helper method to determine SIP active status based on from_date and pause dates
   */
  private determineSipActiveStatus(sip: CamsSipStpDetail, today: Date): string {
    if (sip.from_date) {
      const fromDate = new Date(sip.from_date);
      fromDate.setHours(0, 0, 0, 0);

      if (fromDate > today) {
        return 'PENDING';
      }

      // Check if currently paused
      if (sip.pause_from_date && sip.pause_to_date) {
        const pauseFrom = new Date(sip.pause_from_date);
        const pauseTo = new Date(sip.pause_to_date);
        pauseFrom.setHours(0, 0, 0, 0);
        pauseTo.setHours(0, 0, 0, 0);
        if (pauseFrom <= today && today <= pauseTo) {
          return 'PAUSED';
        }
      }

      return 'ACTIVE';
    }

    return 'ACTIVE';
  }

  /**
   * Calculate XIRR (Extended Internal Rate of Return) for a holding
   * XIRR requires transaction history with amounts and dates
   */
  async calculateXIRR(
    folio: string,
    schemeName?: string,
    currentValue?: number,
  ): Promise<number | null> {
    try {
      // Get all transactions for this folio and scheme, sorted by date
      const transactions = await this.transactionRepo.find({
        where: {
          folio_no: folio,
          scheme: schemeName,
        } as any,
        order: { traddate: 'ASC' },
      });

      if (!transactions || transactions.length === 0) {
        this.logger.debug(
          `No transactions found for folio ${folio}, scheme ${schemeName}`,
        );
        return null;
      }

      // Build cash flow array: negative for purchases, positive for sales
      const cashFlows: { date: Date; amount: number }[] = [];

      for (const txn of transactions) {
        if (txn.traddate && txn.amount) {
          const amount = Number(txn.amount) || 0;
          if (amount !== 0) {
            // Convert date to Date object if it's a string
            let txnDate = txn.traddate;
            if (typeof txnDate === 'string') {
              txnDate = new Date(txnDate);
            }

            // Determine if this is an inflow (investment) or outflow (redemption)
            let isInvestment = true;

            if (txn.trxntype) {
              const txnTypeUpper = txn.trxntype.toUpperCase();
              // Redemptions/Sales are positive cash flow (money received)
              if (
                txnTypeUpper.includes('SELL') ||
                txnTypeUpper.includes('REDEEM') ||
                txnTypeUpper.includes('SWITCH') ||
                txnTypeUpper.includes('DIVIDEND')
              ) {
                isInvestment = false;
              }
            }

            // For investments: negative cash flow (money out)
            // For redemptions: positive cash flow (money in)
            const cfAmount = isInvestment ? -amount : amount;
            cashFlows.push({ date: txnDate, amount: cfAmount });
          }
        }
      }

      // Add current value as final cash flow (positive as it's money that could be received)
      if (currentValue && currentValue > 0) {
        cashFlows.push({ date: new Date(), amount: currentValue });
      }

      // If we don't have enough data points, return null
      if (cashFlows.length < 2) {
        this.logger.debug(
          `Insufficient cash flows (${cashFlows.length}) for XIRR calculation for folio ${folio}`,
        );
        return null;
      }

      // Simple XIRR implementation using Newton-Raphson method
      const xirr = this.calculateXIRRIterative(cashFlows);
      if (xirr !== null) {
        this.logger.debug(
          `XIRR calculated for folio ${folio}, scheme ${schemeName}: ${xirr}%`,
        );
      }
      return xirr;
    } catch (error) {
      this.logger.error(
        `Error calculating XIRR for folio ${folio}, scheme ${schemeName}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Helper: Calculate XIRR using iterative method
   * Newton-Raphson approximation
   */
  private calculateXIRRIterative(
    cashFlows: { date: Date; amount: number }[],
    maxIterations = 100,
    tolerance = 0.00001,
  ): number | null {
    if (cashFlows.length < 2) return null;

    // Check if all cash flows have the same sign (no real return if all in or all out)
    const hasPositive = cashFlows.some((cf) => cf.amount > 0);
    const hasNegative = cashFlows.some((cf) => cf.amount < 0);
    if (!hasPositive || !hasNegative) {
      this.logger.debug(
        'Cash flows do not have mixed signs, cannot calculate XIRR',
      );
      return null;
    }

    // Initial guess: 10% annual return
    let rate = 0.1;
    const dayCount = 365.25;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let npvDerivative = 0;
      const baseDate = cashFlows[0].date;

      for (const cf of cashFlows) {
        let cfDate = cf.date;
        // Ensure date is a Date object
        if (typeof cfDate === 'string') {
          cfDate = new Date(cfDate);
        }

        const daysDiff =
          (cfDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
        const yearFraction = daysDiff / dayCount;

        // Avoid negative base for power calculation
        const base = 1 + rate;
        if (base <= 0) {
          rate = Math.max(rate, -0.999); // Keep rate above -99.9%
          continue;
        }

        const discountFactor = Math.pow(base, yearFraction);

        npv += cf.amount / discountFactor;

        if (discountFactor > 0) {
          npvDerivative +=
            (-yearFraction * cf.amount) / Math.pow(discountFactor, 2);
        }
      }

      // Check for convergence
      if (Math.abs(npv) < tolerance) {
        return Number((rate * 100).toFixed(2));
      }

      // Newton-Raphson update
      if (Math.abs(npvDerivative) < 1e-10) {
        this.logger.debug(
          'NPV derivative too small, cannot continue XIRR calculation',
        );
        return null;
      }

      rate = rate - npv / npvDerivative;

      // Keep rate within reasonable bounds (-99.9% to +500%)
      if (rate < -0.999) rate = -0.999;
      if (rate > 5) rate = 5;
    }

    this.logger.debug(
      `XIRR calculation did not converge after ${maxIterations} iterations`,
    );
    return Number((rate * 100).toFixed(2));
  }

  /**
   * DEBUG: Get all SIP/STP records for analysis
   */
  async getAllSipStpData() {
    try {
      const sipStpRecords = await this.sipStpRepo.find({
        take: 100,
        order: { created_at: 'DESC' },
      });

      // Group by relevant fields to see patterns
      const summary = {
        total_records: sipStpRecords.length,
        unique_schemes: [...new Set(sipStpRecords.map((r) => r.scheme))].length,
        unique_folios: [...new Set(sipStpRecords.map((r) => r.folio_no))]
          .length,
        aut_trntyp_values: [
          ...new Set(sipStpRecords.map((r) => r.aut_trntyp).filter(Boolean)),
        ],
        sample_records: sipStpRecords.slice(0, 10).map((r) => ({
          id: r.id,
          folio_no: r.folio_no,
          scheme: r.scheme,
          target_scheme: r.target_scheme,
          scheme_code: r.scheme_code,
          aut_trntyp: r.aut_trntyp,
          auto_amount: r.auto_amount,
          periodicity: r.periodicity,
          from_date: r.from_date,
          to_date: r.to_date,
          cease_date: r.cease_date,
          status: this.determineSipStatus(r),
        })),
      };

      return summary;
    } catch (error) {
      this.logger.error(`Error fetching SIP/STP debug data: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * Get all transactions for a PAN (used for bulk optimization)
   */
  // async getTransactionsByPan(pan: string) {
  //   try {
  //     // Join is difficult because pan is in static details, not directly on transaction usually?
  //     // Actually transaction table usually has folio, not PAN.
  //     // But we can find all folios for the PAN first.

  //     const folios = await this.investorRepo.find({
  //       select: ['foliochk'],
  //       where: { pan_no: pan } as any
  //     });

  //     const folioNumbers = folios.map(f => f.foliochk).filter(Boolean);

  //     if (folioNumbers.length === 0) return [];

  //     return await this.transactionRepo.createQueryBuilder('txn')
  //       .where('txn.folio_no IN (:...folios)', { folios: folioNumbers })
  //       .orderBy('txn.traddate', 'ASC')
  //       .getMany();
  //   } catch (error) {
  //     this.logger.error(`Error fetching transactions for PAN ${pan}: ${error.message}`);
  //     return [];
  //   }
  // }

  /**
   * Get all SIP/STP records for a PAN (used for bulk optimization)
   */
  // async getSipStpByPan(pan: string) {
  //   try {
  //     const folios = await this.investorRepo.find({
  //       select: ['foliochk'],
  //       where: { pan_no: pan } as any
  //     });

  //     const folioNumbers = folios.map(f => f.foliochk).filter(Boolean);

  //     if (folioNumbers.length === 0) return [];

  //     return await this.sipStpRepo.createQueryBuilder('sip')
  //       .where('sip.folio_no IN (:...folios)', { folios: folioNumbers })
  //       .getMany();
  //   } catch (error) {
  //     this.logger.error(`Error fetching SIP/STP for PAN ${pan}: ${error.message}`);
  //     return [];
  //   }
  // }

  /**
   * Helper: Determine SIP status for a record
   */
  private determineSipStatus(sip: CamsSipStpDetail): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (sip.cease_date) {
      const ceaseDate = new Date(sip.cease_date);
      ceaseDate.setHours(0, 0, 0, 0);
      if (ceaseDate < today) return 'TERMINATED';
    }

    if (sip.to_date) {
      const toDate = new Date(sip.to_date);
      toDate.setHours(0, 0, 0, 0);
      if (toDate < today) return 'EXPIRED';
    }

    if (sip.from_date) {
      const fromDate = new Date(sip.from_date);
      fromDate.setHours(0, 0, 0, 0);
      if (fromDate > today) return 'PENDING';
      return 'ACTIVE';
    }

    return 'UNKNOWN';
  }

  /**
   * Get investment type and SIP status from pre-fetched lists (Optimization)
   */
  getInvestmentTypeAndSIPStatusFromList(
    folio: string,
    amcCode: string,
    allTransactions: CamsInvestorTransaction[],
    allSipStp: CamsSipStpDetail[],
  ): { investment_type: string; sip_status: string } {
    try {
      let investmentType = 'LUMPSUM';
      let sipStatus = 'N/A';
      let hasSipForScheme = false;

      // Filter transactions for this folio
      // amc_code matching is sometimes fuzzy in the original code, sticking to what was there
      const transactions = allTransactions.filter(
        (t) => t.folio_no === folio && (!amcCode || t.amc_code === amcCode),
      );

      if (!transactions || transactions.length === 0) {
        return { investment_type: 'UNKNOWN', sip_status: 'N/A' };
      }

      // Unique product codes & SIP Trxn Nos
      const productCodes = new Set(
        transactions.map((t) => t.prodcode).filter(Boolean),
      );
      const sipTransactionNumbers = new Set(
        transactions.map((t) => t.siptrxnno).filter(Boolean),
      );

      // Filter SIPs for this folio
      const sipStpRecords = allSipStp.filter((s) => s.folio_no === folio);

      // Match logic (Same as original)
      for (const sip of sipStpRecords) {
        let isMatch = false;

        if (sip.auto_trno && sipTransactionNumbers.has(sip.auto_trno))
          isMatch = true;

        if (!isMatch && sip.amc_code && sip.scheme_code) {
          const sipProductCode = `${sip.amc_code}${sip.scheme_code}`;
          if (productCodes.has(sipProductCode)) isMatch = true;
        }

        if (!isMatch && sip.amc_code === amcCode && sip.scheme) {
          const matchedTx = transactions.find(
            (t) =>
              t.scheme &&
              t.scheme.toLowerCase().includes(sip.scheme.toLowerCase()),
          );
          if (matchedTx) isMatch = true;
        }

        if (isMatch) {
          hasSipForScheme = true;
          investmentType = 'SIP';
          if (sip.aut_trntyp && sip.aut_trntyp.toUpperCase().includes('R'))
            investmentType = 'STP';

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (sip.cease_date) {
            const cease = new Date(sip.cease_date);
            cease.setHours(0, 0, 0, 0);
            if (cease < today) sipStatus = 'TERMINATED';
            else if (sip.to_date) {
              const to = new Date(sip.to_date);
              to.setHours(0, 0, 0, 0);
              sipStatus =
                to < today
                  ? 'EXPIRED'
                  : this.determineSipActiveStatus(sip, today);
            } else sipStatus = this.determineSipActiveStatus(sip, today);
          } else if (sip.to_date) {
            const to = new Date(sip.to_date);
            to.setHours(0, 0, 0, 0);
            sipStatus =
              to < today
                ? 'EXPIRED'
                : this.determineSipActiveStatus(sip, today);
          } else if (sip.from_date) {
            sipStatus = this.determineSipActiveStatus(sip, today);
          }
          break;
        }
      }

      if (!hasSipForScheme && transactions.length > 0) {
        investmentType = 'LUMPSUM';
        sipStatus = 'N/A';
      } else if (hasSipForScheme && transactions.length > 1) {
        const hasSIP = transactions.some((t) => t.siptrxnno);
        const hasLump = transactions.some(
          (t) => !t.siptrxnno && ['BUY', 'SIP', 'LUMPSUM'].includes(t.trxntype),
        );
        if (hasSIP && hasLump)
          investmentType = investmentType === 'STP' ? 'STP/MIXED' : 'SIP/MIXED';
      }

      return { investment_type: investmentType, sip_status: sipStatus };
    } catch (error) {
      return { investment_type: 'UNKNOWN', sip_status: 'N/A' };
    }
  }

  /**
   * Calculate XIRR from pre-fetched transactions list (Optimization)
   */
  calculateXIRRFromList(
    folio: string,
    schemeName: string,
    currentValue: number,
    allTransactions: CamsInvestorTransaction[],
  ): number | null {
    try {
      // Filter transactions
      const transactions = allTransactions.filter(
        (t) => t.folio_no === folio && t.scheme === schemeName,
      );
      // Sort by date
      transactions.sort((a, b) => {
        const da =
          a.traddate instanceof Date ? a.traddate : new Date(a.traddate);
        const db =
          b.traddate instanceof Date ? b.traddate : new Date(b.traddate);
        return da.getTime() - db.getTime();
      });

      if (!transactions || transactions.length === 0) return null;

      const cashFlows: { date: Date; amount: number }[] = [];

      for (const txn of transactions) {
        if (txn.traddate && txn.amount) {
          const amount = Number(txn.amount) || 0;
          if (amount !== 0) {
            let txnDate =
              txn.traddate instanceof Date
                ? txn.traddate
                : new Date(txn.traddate);
            let isInvestment = true;
            if (txn.trxntype) {
              const t = txn.trxntype.toUpperCase();
              if (
                t.includes('SELL') ||
                t.includes('REDEEM') ||
                t.includes('SWITCH') ||
                t.includes('DIVIDEND')
              ) {
                isInvestment = false;
              }
            }
            const cfAmount = isInvestment ? -amount : amount;
            cashFlows.push({ date: txnDate, amount: cfAmount });
          }
        }
      }

      if (currentValue && currentValue > 0) {
        cashFlows.push({ date: new Date(), amount: currentValue });
      }

      return this.calculateXIRRIterative(cashFlows);
    } catch (error) {
      return null;
    }
  }
  /**
   * Bulk fetch ISINs for multiple schemes (Optimization)
   */
  async getISINsBySchemes(
    schemes: { amc_code?: string; sch_code?: string; sch_name?: string }[],
  ): Promise<Map<string, string>> {
    try {
      const schemeMap = new Map<string, string>();
      if (schemes.length === 0) return schemeMap;

      const schemeNames = schemes
        .map((s) => s.sch_name)
        .filter(Boolean) as string[];

      // 1. Fetch by Scheme Names (Primary)
      if (schemeNames.length > 0) {
        const schemesFound = await this.schemeRepo
          .createQueryBuilder('s')
          .where('s.sch_name IN (:...names)', { names: schemeNames })
          .getMany();

        schemesFound.forEach((s) => {
          if (s.sch_name && s.isin_no) {
            schemeMap.set(s.sch_name, s.isin_no);
          }
        });
      }

      return schemeMap;
    } catch (error) {
      this.logger.error(`Error bulk fetching ISINs: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Bulk fetch Latest NAVs and Yesterday's NAVs for multiple ISINs
   */
  async getNAVsByISINs(
    isins: string[],
  ): Promise<{ current: Map<string, number>; yesterday: Map<string, number> }> {
    try {
      const uniqueIsins = [...new Set(isins)].filter(Boolean);
      if (uniqueIsins.length === 0)
        return { current: new Map(), yesterday: new Map() };

      const currentMap = new Map<string, number>();
      const yesterdayMap = new Map<string, number>();

      // Fetch recent data (last 7 days) for these ISINs and process in memory.
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentNavs = await this.navHistoryRepo
        .createQueryBuilder('nav')
        .where('nav.navDate >= :sevenDaysAgo', { sevenDaysAgo })
        .andWhere(
          '(nav.isinPayoutGrowth IN (:...isins) OR nav.isinReinvestment IN (:...isins))',
          { isins: uniqueIsins },
        )
        .orderBy('nav.navDate', 'DESC')
        .getMany();

      // Process in memory
      // Group by ISIN
      const navsByIsin = new Map<string, NavHistory[]>();

      recentNavs.forEach((nav) => {
        const isin1 = nav.isinPayoutGrowth;
        const isin2 = nav.isinReinvestment;

        // It could match either.
        if (isin1 && uniqueIsins.includes(isin1)) {
          if (!navsByIsin.has(isin1)) navsByIsin.set(isin1, []);
          navsByIsin.get(isin1)!.push(nav);
        }
        if (isin2 && uniqueIsins.includes(isin2)) {
          if (!navsByIsin.has(isin2)) navsByIsin.set(isin2, []);
          navsByIsin.get(isin2)!.push(nav);
        }
      });

      navsByIsin.forEach((navs, isin) => {
        // Sort desc
        navs.sort(
          (a, b) =>
            new Date(b.navDate).getTime() - new Date(a.navDate).getTime(),
        );

        if (navs.length > 0) {
          const latest = navs[0];
          const latestDate = new Date(latest.navDate);
          latestDate.setHours(0, 0, 0, 0);

          currentMap.set(isin, Number(latest.nav));

          // Find "yesterday" (previous active day)
          if (navs.length > 1) {
            yesterdayMap.set(isin, Number(navs[1].nav));
          }
        }
      });

      return { current: currentMap, yesterday: yesterdayMap };
    } catch (error) {
      this.logger.error(`Error bulk fetching NAVs: ${error.message}`);
      return { current: new Map(), yesterday: new Map() };
    }
  }
}
