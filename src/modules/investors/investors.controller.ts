import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { InvestorService } from './investors.service';
import { InvestorQueryDto, GenerateCredentialsDto } from './dtos';
import { InvestorsHoldingsService } from './investors-holdings.service';
import { ResponseFormatter } from 'src/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserRole } from 'src/entities/user-profile.entity';
import { InvestorsExportService } from './investors-export.service';
import { TransactionsExportService } from './transactions-export.service';
import type { Response } from 'express';

/**
 * Investor Controller - REST endpoints for investor operations
 */
@Controller('api/investors')
export class InvestorController {
  private readonly logger = new Logger(InvestorController.name);

  constructor(
    private investorService: InvestorService,
    private holdingsService: InvestorsHoldingsService,
    private investorsExportService: InvestorsExportService,
    private transactionsExportService: TransactionsExportService,
  ) {}

  /**
   * GET /api/investors
   * Get all investors with pagination and filtering
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: InvestorQueryDto, @Req() req: any) {
    this.logger.debug(
      `Fetching investors - page: ${query.page}, limit: ${query.limit}`,
    );
    const access = await this.investorService['hierarchyAccess'].resolveAccess(
      req.user,
    );
    const result = await this.investorService.findAll(
      query.page,
      query.limit,
      access,
    );
    return ResponseFormatter.paginated(
      result?.data || [],
      result?.total || 0,
      result?.page || 1,
      result?.limit || 10,
    );
  }

  /**
   * GET /api/investors/search
   * Search investors by name, email, mobile, or PAN
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async search(
    @Query('q') searchTerm: string,
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    if (!searchTerm) {
      return ResponseFormatter.error(
        'Search term is required',
        'SEARCH_TERM_REQUIRED',
      );
    }

    this.logger.debug(
      `Searching investors - term: ${searchTerm}, page: ${page}`,
    );
    const access = await this.investorService['hierarchyAccess'].resolveAccess(
      req.user,
    );
    const result = await this.investorService.search(
      searchTerm,
      page,
      limit,
      access,
    );
    return ResponseFormatter.paginated(
      result?.data || [],
      result?.total || 0,
      result?.page || 1,
      result?.limit || 10,
    );
  }

  /**
   * GET /api/investors/holdings
   * Get investor's current portfolio/holdings
   */
  @Get('holdings')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getInvestorHoldings(@Req() req: any) {
    const userSnapshot = req.user;
    if (userSnapshot.type !== 'investor') {
      throw new ForbiddenException('You can only view your own holdings');
    }
    const investorHoldings = await this.holdingsService.getHoldingsReport(
      userSnapshot.id,
    );
    return ResponseFormatter.success(
      investorHoldings,
      'Investor holdings retrieved successfully',
    );
  }

  /**
   * GET /api/investors/:id
   * Get investor by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string, @Req() req: any) {
    this.logger.debug(`Fetching investor - id: ${id}`);
    const targetInvestorId =
      await this.investorService.assertInvestorReadAccess(req.user, id);
    const investor = await this.investorService.findById(targetInvestorId);
    return ResponseFormatter.success(
      investor,
      'Investor retrieved successfully',
    );
  }

  /**
   * GET /api/investors/:id/transactions/export
   * Generate PDF export for investor's transactions
   */
  @Post(':id/transactions/export')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async exportTransactions(
    @Param('id') investorId: string,
    @Body('distributor_info') distributorInfo: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    const targetInvestorId =
      await this.investorService.assertInvestorReadAccess(req.user, investorId);

    const txnData =
      await this.holdingsService.getTransactionReport(targetInvestorId);

    // Generate the PDF buffer via the new service
    const buffer = await this.transactionsExportService.generatePDF(
      txnData,
      distributorInfo,
    );

    // Fallback file name formatting
    const rawData = txnData as any;
    const rawName = Array.isArray(rawData)
      ? rawData[0]?.investor_name || 'Investor'
      : rawData?.investor_name ||
        rawData?.clientName ||
        rawData?.investorDetails?.name ||
        'Investor';
    const investorNameFormatted = rawName
      .toLowerCase()
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('_')
      .replace(/[^a-zA-Z0-9_]/gi, '');

    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '_');
    const filename = `${investorNameFormatted}_Transactions_${today}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * GET /api/investors/by-folio/:folio
   * Get investor by folio number
   */
  // @Get('by-folio/:folio')
  // @HttpCode(HttpStatus.OK)
  // async findByFolio(@Param('folio') folio: string) {
  //   this.logger.debug(`Fetching investor - folio: ${folio}`);
  //   const investor = await this.investorService.findByFolio(folio);
  //   return ResponseFormatter.success(investor, 'Investor retrieved successfully');
  // }

  /**
   * GET /api/investors/by-pan/:pan
   * Get investor by PAN
   */
  @Get('by-pan/:pan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findByPan(@Param('pan') pan: string, @Req() req: any) {
    this.logger.debug(`Fetching investor - PAN: ${pan}`);
    const investor = await this.investorService.findByPan(pan);
    if (investor) {
      await this.investorService.assertInvestorReadAccess(
        req.user,
        investor.id,
      );
    }
    return ResponseFormatter.success(
      investor,
      'Investor retrieved successfully',
    );
  }

  /**
   * GET /api/investors/stats
   * Get investor statistics
   */
  // @Get('stats/overview')
  // @HttpCode(HttpStatus.OK)
  // async getStatistics() {
  //   this.logger.debug('Fetching investor statistics');
  //   const stats = await this.investorService.getStatistics();
  //   return ResponseFormatter.success(stats, 'Investor statistics retrieved successfully');
  // }

  /**
   * GET /api/investors/:id/holdings
   * Get investor's current portfolio/holdings
   */
  @Get(':id/holdings')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getHoldings(@Param('id') id: string, @Req() req: any) {
    const targetInvestorId =
      await this.investorService.assertInvestorReadAccess(req.user, id);
    const holdings =
      await this.holdingsService.getHoldingsReport(targetInvestorId);
    return ResponseFormatter.success(
      holdings,
      'Holdings retrieved successfully',
    );
  }

  /**
   * GET /api/investors/:id/balance
   * Get investor account balance summary
   */
  // @Get(':id/balance')
  // @HttpCode(HttpStatus.OK)
  // async getBalance(@Param('id') id: string) {
  //   this.logger.debug(`Fetching balance for investor - id: ${id}`);
  //   const balance = await this.investorService.getBalance(id);
  //   return ResponseFormatter.success(balance, 'Balance summary retrieved successfully');
  // }

  /**
   * GET /api/investors/:id/folio-status
   * Get investor folio status and details
   */
  // @Get(':id/folio-status')
  // @HttpCode(HttpStatus.OK)
  // async getFolioStatus(@Param('id') id: string) {
  //   this.logger.debug(`Fetching folio status for investor - id: ${id}`);
  //   const folioStatus = await this.investorService.getFolioStatus(id);
  //   return ResponseFormatter.success(folioStatus, 'Folio status retrieved successfully');
  // }

  /**
   * DEBUG: GET /api/investors/debug/sip-data
   * Get all SIP/STP data for analysis
   */
  // @Get('debug/sip-data')
  // @HttpCode(HttpStatus.OK)
  // async debugSipData() {
  //   this.logger.debug(`Fetching SIP/STP debug data`);
  //   const sipData = await this.investorService.getSipStpDebugData();
  //   return ResponseFormatter.success(sipData, 'SIP/STP debug data retrieved');
  // }

  /**
   * POST /api/investors/:id/credentials
   * Generate username/password and update email for investor
   */
  @Post(':id/credentials')
  @HttpCode(HttpStatus.OK)
  async generateCredentials(
    @Param('id') id: string,
    @Body() dto: GenerateCredentialsDto,
  ) {
    this.logger.debug(`Generating credentials for investor - id: ${id}`);
    const result = await this.investorService.generateCredentials(
      id,
      dto?.email,
    );
    return ResponseFormatter.success(
      result,
      'Investor credentials generated successfully',
    );
  }

  /**
   * POST /api/investors/capital-gains
   * Get investor's capital gains report
   */
  @Post('capital-gains')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCapitalGains(@Body() body: any, @Req() req: any) {
    const { investor_id, start_date, end_date } = body;

    if (!start_date || !end_date) {
      throw new BadRequestException(
        'start_date and end_date are required in the request body',
      );
    }

    const targetInvestorId =
      await this.investorService.assertInvestorReadAccess(
        req.user,
        investor_id,
      );

    const gains = await this.holdingsService.getCapitalGainsReport(
      targetInvestorId,
      start_date,
      end_date,
    );
    return ResponseFormatter.success(
      gains,
      'Capital gains retrieved successfully',
    );
  }

  /**
   * GET /api/investors/:id/holdings/export
   * Generate PDF export for investor's portfolio holdings
   */
  @Post(':id/holdings/export')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async exportHoldings(
    @Param('id') investorId: string,
    @Body('distributor_info') distributorInfo: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    const targetInvestorId =
      await this.investorService.assertInvestorReadAccess(req.user, investorId);

    const holdingsData =
      await this.holdingsService.getHoldingsReport(targetInvestorId);

    const buffer =
      await this.investorsExportService.generatePortfolioValuationPDF(
        holdingsData,
        distributorInfo,
      );

    // Title Case formatting for filename
    const rawName =
      holdingsData?.investor_name || holdingsData?.clientName || 'Investor';
    const investorNameFormatted = rawName
      .toLowerCase()
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('_')
      .replace(/[^a-zA-Z0-9_]/gi, '');
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '_');
    const filename = `${investorNameFormatted}_Holdings_${today}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * POST /api/investors/transaction-report
   * Get investor's transaction report
   */
  @Post('transaction-report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTransactionReport(@Body() body: any, @Req() req: any) {
    const { investor_id } = body;
    const targetInvestorId =
      await this.investorService.assertInvestorReadAccess(
        req.user,
        investor_id,
      );

    const report =
      await this.holdingsService.getTransactionReport(targetInvestorId);
    return ResponseFormatter.success(
      report,
      'Transactions retrieved successfully',
    );
  }
}
