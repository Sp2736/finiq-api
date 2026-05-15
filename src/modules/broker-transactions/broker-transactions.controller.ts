import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { BrokerTransactionsService } from './broker-transactions.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { ResponseFormatter } from 'src/common'; // Assuming you use this based on your other files

@Controller('api/admin/broker-transactions')
@UseGuards(JwtAuthGuard, RoleGuard)
export class BrokerTransactionsController {
  constructor(private readonly transactionService: BrokerTransactionsService) {}

  @Get('summary')
  async getSummary(@Req() req: any) {
    const companyId =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
      req.user?.company_id;
    if (!companyId) {
      throw new BadRequestException('Company ID is required');
    }
    const result = await this.transactionService.getLedgerSummary(companyId);
    return ResponseFormatter.success(result, 'Ledger summary fetched');
  }

  @Get(':subBrokerId/history')
  async getHistory(@Param('subBrokerId') subBrokerId: string) {
    if (!subBrokerId) {
      throw new BadRequestException('Sub-broker ID is required');
    }
    const result =
      await this.transactionService.getTransactionHistory(subBrokerId);
    return ResponseFormatter.success(result, 'Transaction history fetched');
  }
}
