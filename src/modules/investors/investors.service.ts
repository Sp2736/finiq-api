import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BaseService, PaginationHelper, NotFoundException, ResponseFormatter, CacheService } from 'src/common';
import { CamsInvestorStaticDetail, Investor } from 'src/entities';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { InvestorRepository } from './investors.repository';
import { InvestorResponseDto, InvestorDto, InvestorListItemDto, PortfolioHoldingsDto, BalanceSummaryDto, FolioStatusDetailsDto } from './dtos';

import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

/**
 * Investor Service - Business logic for investor operations
 */
@Injectable()
export class InvestorService extends BaseService<CamsInvestorStaticDetail, any, any> {
  protected readonly logger = new Logger(InvestorService.name);
  private readonly CACHE_PREFIX = 'investors';

  constructor(
    private investorRepository: InvestorRepository,
    @InjectRepository(InvestorMapping)
    private readonly investorMappingRepo: Repository<InvestorMapping>,
    private cacheService: CacheService,
  ) {
    super();
  }

  /**
   * Check if a broker has access to an investor
   */
  async checkBrokerAccess(brokerProfileId: string, investorId: string): Promise<boolean> {
    const mapping = await this.investorMappingRepo.findOne({
      where: {
        sub_broker_id: brokerProfileId,
        investor_id: investorId,
        is_active: true,
      },
    });
    return !!mapping;
  }

  /**
   * Get all investors with pagination and filtering
   */
  async findAll(page: number = 1, limit: number = 10) {
    try {
      const pagination = PaginationHelper.getPaginationParams(page, limit);

      const [data, total] = await this.investorRepository.findAll(pagination);

      const investors = data.map((inv) => this.mapToListDto(inv));
      return this.formatPaginatedResponse(investors, total, pagination);
    } catch (error) {
      await this.handleError(error, 'findAll');
      throw error;
    }
  }

  /**
   * Get investor by ID
   */
  async findById(id: string): Promise<InvestorDto> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}:${id}`;
      const cached = this.cacheService.get<InvestorDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for investor ${id}`);
        return cached;
      }

      const investor = await this.investorRepository.findById(id);
      if (!investor) {
        throw new NotFoundException('Investor', `id ${id}`);
      }

      const result = this.mapToDetailsDto(investor);
      this.cacheService.set(cacheKey, result, 3600000); // Cache for 1 hour

      return result;
    } catch (error) {
      await this.handleError(error, 'findById');
      throw error;
    }
  }

  /**
   * Get the latest address for an investor from static details
   */
  async getInvestorAddress(investorId: string) {
    return this.investorRepository.getLatestAddress(investorId);
  }

  /**
   * Get investor by folio number
   */
  // async findByFolio(folio: string): Promise<InvestorDetailsDto> {
  //   try {
  //     // Check cache first
  //     const cacheKey = `${this.CACHE_PREFIX}:folio:${folio}`;
  //     const cached = this.cacheService.get<InvestorDetailsDto>(cacheKey);
  //     if (cached) {
  //       this.logger.debug(`Cache hit for folio ${folio}`);
  //       return cached;
  //     }

  //     const investor = await this.investorRepository.findByFolio(folio);
  //     if (!investor) {
  //       throw new NotFoundException('Investor', `folio ${folio}`);
  //     }

  //     const result = this.mapToDetailsDto(investor);
  //     this.cacheService.set(cacheKey, result, 3600000);

  //     return result;
  //   } catch (error) {
  //     await this.handleError(error, 'findByFolio');
  //     throw error;
  //   }
  // }

  /**
   * Get investor by PAN
   */
  async findByPan(pan: string): Promise<InvestorDto> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}:pan:${pan}`;
      const cached = this.cacheService.get<InvestorDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for PAN ${pan}`);
        return cached;
      }

      const investor = await this.investorRepository.findByPan(pan);
      if (!investor) {
        throw new NotFoundException('Investor', `PAN ${pan}`);
      }

      const result = this.mapToDetailsDto(investor);
      this.cacheService.set(cacheKey, result, 3600000);

      return result;
    } catch (error) {
      await this.handleError(error, 'findByPan');
      throw error;
    }
  }

  /**
   * Get investor by email
   */
  async findByEmail(email: string): Promise<InvestorDto | null> {
    try {
      const investor = await this.investorRepository.findByEmail(email);
      if (!investor) return null;
      return this.mapToDetailsDto(investor);
    } catch (error) {
      await this.handleError(error, 'findByEmail');
      throw error;
    }
  }

  /**
   * Search investors
   */
  async search(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      // Get pagination parameters
      const pagination = PaginationHelper.getPaginationParams(page, limit);

      // Call the repository search method
      const [data, total] = await this.investorRepository.search(searchTerm, pagination);

      // Map the returned data to the API response
      const investors = data.map((inv) => ({
        ...this.mapToListDto(inv),
        assigned_broker: inv.mappings?.[0]?.sub_broker ? {
          name: inv.mappings[0].sub_broker.name,
          arn: inv.mappings[0].sub_broker.arn_id
        } : null
      }));

      // Format the paginated response
      return this.formatPaginatedResponse(investors, total, pagination);
    } catch (error) {
      await this.handleError(error, 'search');
    }
  }

  /**
   * Generate next username (A00001 -> Z99999 -> AA0001 etc.)
   */
  private generateNextUsername(currentMax: string | null): string {
    if (!currentMax) return 'A00001';

    // Parse current username (e.g. A00001 -> 'A', '00001')
    const match = currentMax.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 'A00001';

    let prefix = match[1];
    let num = parseInt(match[2], 10);

    const padLength = match[2].length;
    const maxNum = Math.pow(10, padLength) - 1; // 99999

    if (num < maxNum) {
      num++;
    } else {
      // Increment alphabetical prefix
      num = 1;
      let chars = prefix.split('');
      let i = chars.length - 1;
      while (i >= 0) {
        if (chars[i] === 'Z') {
          chars[i] = 'A';
          i--;
        } else {
          chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
          break;
        }
      }
      if (i < 0) {
        chars.unshift('A'); // Overflow from Z to AA
      }
      prefix = chars.join('');
    }

    return `${prefix}${num.toString().padStart(padLength, '0')}`;
  }

  /**
   * Add/update email and generate credentials for the investor
   */
  async generateCredentials(investorId: string, email?: string) {
    try {
      if (!email) {
        throw new BadRequestException('Email is required to generate credentials');
      }

      const investor = await this.investorRepository.findById(investorId);
      if (!investor) throw new NotFoundException('Investor', `id ${investorId}`);

      if (investor.username) {
        throw new BadRequestException('Credentials have already been generated for this investor');
      }

      const existingAccount = await this.investorRepository.findByEmail(email);
      if (existingAccount && existingAccount.id !== investorId) {
        throw new BadRequestException('Email is already in use by another investor');
      }

      investor.email = email;

      const lastUsernameInvestor = await this.investorRepository.findLatestUsername();
      const nextUsername = this.generateNextUsername(lastUsernameInvestor?.username || null);
      investor.username = nextUsername;

      // Generate a random 8 char alphanumeric password
      const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();

      // Hash password
      investor.password_hash = await bcrypt.hash(tempPassword, 10);
      investor.must_change_password = true;

      await this.investorRepository.save(investor);

      return {
        username: investor.username,
        password: tempPassword,
        email: investor.email,
        message: 'Credentials generated successfully'
      };
    } catch (error) {
      await this.handleError(error, 'generateCredentials');
      throw error;
    }
  }


  /**
   * Get investor statistics
   */
  // async getStatistics() {
  //   try {
  //     // Check cache first
  //     const cacheKey = `${this.CACHE_PREFIX}:stats`;
  //     const cached = this.cacheService.get(cacheKey);
  //     if (cached) {
  //       return cached;
  //     }

  //     const stats = await this.investorRepository.getStats();
  //     this.cacheService.set(cacheKey, stats, 300000); // Cache for 5 minutes

  //     return stats;
  //   } catch (error) {
  //     await this.handleError(error, 'getStatistics');
  //   }
  // }

  /**
   * Map entity to list item DTO
   */
  private mapToListDto(investor: Investor): InvestorListItemDto {
    return {
      id: investor.id,
      investor_name: investor.name ?? '',
      pan_no: investor.pan,
      mobile_no: investor.mobile ?? '',
      guardian_pan: investor.guardian_pan ?? '',
      username: investor.username ?? '',
      email: investor.email ?? '',
      assigned_broker: investor.mappings?.[0]?.sub_broker ? {
        name: investor.mappings[0].sub_broker.name,
        arn: investor.mappings[0].sub_broker.arn_id
      } : null
    };
  }

  /**
   * Map entity to details DTO
   */
  private mapToDetailsDto(investor: Investor): InvestorDto {
    return {
      id: investor.id,
      company_id: investor.company_id,
      name: investor.name ?? null,
      pan: investor.pan,
      is_guest_pan: investor.is_guest_pan,
      date_of_birth: investor.date_of_birth ?? null,
      email: investor.email ?? null,
      mobile: investor.mobile ?? null,
      guardian_name: investor.guardian_name ?? null,
      guardian_pan: investor.guardian_pan ?? null,
      created_at: investor.created_at,
      updated_at: investor.updated_at,
    };
  }

  /**
   * Get investor portfolio holdings
   */
  // async getHoldings(investorId: string): Promise<PortfolioHoldingsDto> {
  //   try {
  //     const cacheKey = `${this.CACHE_PREFIX}:holdings:${investorId}`;
  //     const cached = this.cacheService.get<PortfolioHoldingsDto>(cacheKey);
  //     if (cached) {
  //       this.logger.debug(`Cache hit for holdings ${investorId}`);
  //       return cached;
  //     }

  //     const holdings = await this.investorRepository.getHoldings(investorId);
  //     if (!holdings || holdings.length === 0) {
  //       throw new NotFoundException('Holdings', `investor ${investorId}`);
  //     }

  //     const investor = holdings[0];
  //     const pan = investor.pan_no;

  //     // Bulk fetch optimization: Get all transactions and SIPs for this PAN once
  //     const [allTransactions, allSipStp] = await Promise.all([
  //       this.investorRepository.getTransactionsByPan(pan),
  //       this.investorRepository.getSipStpByPan(pan),
  //     ]);

  //     this.logger.debug(`Bulk fetched ${allTransactions.length} txns and ${allSipStp.length} SIPs for PAN ${pan}`);

  //     // Group holdings by scheme to get unique investments
  //     const holdingsByScheme = new Map<string, CamsInvestorStaticDetail[]>();
  //     holdings.forEach((h) => {
  //       const schemeKey = h.sch_name || 'Unknown Scheme';
  //       if (!holdingsByScheme.has(schemeKey)) {
  //         holdingsByScheme.set(schemeKey, []);
  //       }
  //       holdingsByScheme.get(schemeKey)!.push(h);
  //     });

  //     // Optimization: Bulk fetch ISINs and NAVs for all schemes
  //     const allSchemes = Array.from(holdingsByScheme.values()).map(h => ({
  //       amc_code: h[0].amc_code,
  //       sch_code: h[0].product,
  //       sch_name: h[0].sch_name
  //     }));

  //     const isinMap = await this.investorRepository.getISINsBySchemes(allSchemes);
  //     const allIsins = Array.from(isinMap.values());
  //     const { current: currentNavMap, yesterday: yesterdayNavMap } = await this.investorRepository.getNAVsByISINs(allIsins);

  //     // Aggregate holdings by scheme with NAV calculation
  //     const aggregatedHoldings = await Promise.all(
  //       Array.from(holdingsByScheme.values()).map(async (schemeHoldings) => {
  //         const firstHolding = schemeHoldings[0];
  //         const totalUnits = schemeHoldings.reduce((sum, h) => sum + (Number(h.clos_bal) || 0), 0);
  //         const investedAmount = schemeHoldings.reduce((sum, h) => sum + (Number(h.rupee_bal) || 0), 0);

  //         // Get latest NAV for current value calculation using ISIN
  //         let currentValue = investedAmount;
  //         let navRate = 0;
  //         let isinFound: string | null = null;

  //         if (firstHolding.sch_name) {
  //           isinFound = isinMap.get(firstHolding.sch_name) || null;
  //         }

  //         if (isinFound) {
  //           const nav = currentNavMap.get(isinFound);
  //           if (nav) {
  //             navRate = nav;
  //             currentValue = totalUnits * navRate;
  //           }
  //         }

  //         const gainLoss = currentValue - investedAmount;
  //         const gainLossPercentage = investedAmount > 0 ? ((gainLoss / investedAmount) * 100) : 0;

  //         // Get investment type and SIP status (Optimized using in-memory list)
  //         let investmentType = 'LUMPSUM';
  //         let sipStatus = 'N/A';
  //         try {
  //           const invTypeInfo = this.investorRepository.getInvestmentTypeAndSIPStatusFromList(
  //             firstHolding.foliochk,
  //             firstHolding.amc_code,
  //             allTransactions,
  //             allSipStp,
  //           );
  //           investmentType = invTypeInfo.investment_type;
  //           sipStatus = invTypeInfo.sip_status;
  //         } catch (error) {
  //           this.logger.warn(
  //             `Could not fetch investment type for folio ${firstHolding.foliochk}: ${error.message}`,
  //           );
  //         }

  //         // Get 1-day NAV change
  //         let oneDayChange: number | null = null;
  //         if (isinFound) {
  //           const todayNav = currentNavMap.get(isinFound);
  //           const yesterdayNav = yesterdayNavMap.get(isinFound);
  //           if (todayNav && yesterdayNav) {
  //             oneDayChange = Number((((todayNav - yesterdayNav) / yesterdayNav) * 100).toFixed(4));
  //           }
  //         }

  //         // Calculate XIRR (Optimized using in-memory list)
  //         let xirr: number | null = null;
  //         try {
  //           xirr = this.investorRepository.calculateXIRRFromList(
  //             firstHolding.foliochk,
  //             firstHolding.sch_name,
  //             currentValue,
  //             allTransactions,
  //           );
  //         } catch (error) {
  //           this.logger.warn(
  //             `Could not calculate XIRR for folio ${firstHolding.foliochk}: ${error.message}`,
  //           );
  //         }

  //         return {
  //           foliochk: schemeHoldings.map((h) => h.foliochk).join(', '),
  //           sch_code: firstHolding.product || '',
  //           sch_name: firstHolding.sch_name || '',
  //           amc_code: firstHolding.amc_code,
  //           amc_name: '',
  //           quantity: totalUnits,
  //           closing_balance: totalUnits,
  //           invested_amount: investedAmount,
  //           current_value: currentValue,
  //           gain_loss: gainLoss,
  //           gain_loss_percentage: gainLossPercentage,
  //           nav_rate: navRate,
  //           rupee_balance: investedAmount,
  //           product: firstHolding.product,
  //           last_updated: firstHolding.created_at,
  //           investment_type: investmentType,
  //           sip_status: sipStatus,
  //           one_day_change: oneDayChange,
  //           xirr: xirr,
  //           abs: gainLoss, // Absolute gain/loss
  //         };
  //       }),
  //     );

  //     // Calculate portfolio totals
  //     const totalInvested = aggregatedHoldings.reduce((sum, h) => sum + h.invested_amount, 0);
  //     const totalCurrent = aggregatedHoldings.reduce((sum, h) => sum + h.current_value, 0);
  //     const totalGainLoss = totalCurrent - totalInvested;

  //     const result: PortfolioHoldingsDto = {
  //       investor_id: investorId,
  //       folio_number: holdings.map((h) => h.foliochk).join(', '),
  //       investor_name: investor.inv_name,
  //       total_holdings: holdingsByScheme.size,
  //       total_units: holdings.reduce((sum, h) => sum + (Number(h.clos_bal) || 0), 0),
  //       total_market_value: totalCurrent,
  //       total_invested: totalInvested,
  //       total_gain_loss: totalGainLoss,
  //       total_return_percentage: totalInvested > 0 ? ((totalGainLoss / totalInvested) * 100) : 0,
  //       holdings: aggregatedHoldings,
  //       last_updated: new Date(),
  //     };

  //     this.cacheService.set(cacheKey, result, 1800000); // Cache for 30 minutes
  //     return result;
  //   } catch (error) {
  //     await this.handleError(error, 'getHoldings');
  //     throw error;
  //   }
  // }

  /**
   * Get investor account balance summary
   */
  // async getBalance(investorId: string): Promise<BalanceSummaryDto> {
  //   try {
  //     const cacheKey = `${this.CACHE_PREFIX}:balance:${investorId}`;
  //     const cached = this.cacheService.get<BalanceSummaryDto>(cacheKey);
  //     if (cached) {
  //       this.logger.debug(`Cache hit for balance ${investorId}`);
  //       return cached;
  //     }

  //     const balance = await this.investorRepository.getBalance(investorId);
  //     if (!balance) {
  //       throw new NotFoundException('Investor', `id ${investorId}`);
  //     }

  //     const result: BalanceSummaryDto = {
  //       investor_id: investorId,
  //       pan_number: balance.pan_no,
  //       investor_name: balance.inv_name,
  //       total_folio_count: 1,
  //       aggregate_units: Number(balance.clos_bal) || 0,
  //       aggregate_rupee_value: Number(balance.rupee_bal) || 0,
  //       aggregate_market_value: Number(balance.rupee_bal) || 0,
  //       aggregate_invested: Number(balance.rupee_bal) || 0,
  //       aggregate_gain_loss: 0,
  //       aggregate_return_percentage: 0,
  //       folio_balances: [
  //         {
  //           investor_id: investorId,
  //           folio_number: balance.foliochk,
  //           investor_name: balance.inv_name,
  //           units_balance: Number(balance.clos_bal) || 0,
  //           rupee_balance: Number(balance.rupee_bal) || 0,
  //           market_value: Number(balance.rupee_bal) || 0,
  //           invested_amount: Number(balance.rupee_bal) || 0,
  //           gain_loss: 0,
  //           return_percentage: 0,
  //           nav_rate: 0,
  //           currency: 'INR',
  //           as_on_date: new Date(),
  //           last_transaction_date: balance.created_at,
  //         },
  //       ],
  //       snapshot_date: new Date(),
  //     };

  //     this.cacheService.set(cacheKey, result, 1800000); // Cache for 30 minutes
  //     return result;
  //   } catch (error) {
  //     await this.handleError(error, 'getBalance');
  //     throw error;
  //   }
  // }

  /**
   * Get investor folio status and details
   */
  // async getFolioStatus(investorId: string): Promise<FolioStatusDetailsDto> {
  //   try {
  //     const cacheKey = `${this.CACHE_PREFIX}:folio-status:${investorId}`;
  //     const cached = this.cacheService.get<FolioStatusDetailsDto>(cacheKey);
  //     if (cached) {
  //       this.logger.debug(`Cache hit for folio status ${investorId}`);
  //       return cached;
  //     }

  //     const folios = await this.investorRepository.getFolioStatus(investorId);
  //     if (!folios || folios.length === 0) {
  //       throw new NotFoundException('Folio', `investor ${investorId}`);
  //     }

  //     const investor = folios[0];
  //     const result: FolioStatusDetailsDto = {
  //       investor_id: investorId,
  //       pan_number: investor.pan_no,
  //       investor_name: investor.inv_name,
  //       total_folios: folios.length,
  //       active_folios: folios.filter((f) => Number(f.rupee_bal) > 0).length,
  //       inactive_folios: folios.filter((f) => Number(f.rupee_bal) === 0).length,
  //       total_rupee_value: folios.reduce((sum, f) => sum + (Number(f.rupee_bal) || 0), 0),
  //       total_market_value: folios.reduce((sum, f) => sum + (Number(f.rupee_bal) || 0), 0),
  //       folio_details: folios.map((f) => ({
  //         foliochk: f.foliochk,
  //         folio_number: f.foliochk,
  //         scheme_code: f.product || '',
  //         scheme_name: f.sch_name || '',
  //         amc_code: f.amc_code,
  //         amc_name: '',
  //         status: Number(f.rupee_bal) > 0 ? 'Active' : 'Inactive',
  //         current_balance: Number(f.clos_bal) || 0,
  //         market_value: Number(f.rupee_bal) || 0,
  //         last_transaction_date: f.created_at,
  //         transaction_count: 1,
  //         account_type: f.ac_type,
  //       })),
  //       last_updated: new Date(),
  //       overall_status: folios.some((f) => Number(f.rupee_bal) > 0) ? 'Active' : 'Inactive',
  //     };

  //     this.cacheService.set(cacheKey, result, 1800000); // Cache for 30 minutes
  //     return result;
  //   } catch (error) {
  //     await this.handleError(error, 'getFolioStatus');
  //     throw error;
  //   }
  // }

  /**
   * DEBUG: Get all SIP/STP records for analysis
   */
  // async getSipStpDebugData() {
  //   try {
  //     return await this.investorRepository.getAllSipStpData();
  //   } catch (error) {
  //     await this.handleError(error, 'getSipStpDebugData');
  //     throw error;
  //   }
  // }
}
