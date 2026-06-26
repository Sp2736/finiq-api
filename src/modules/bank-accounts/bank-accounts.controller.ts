import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';

@Controller('api/admin/bank-accounts')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN) // Securing the endpoint
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  async getBankAccounts(@Query('sub_broker_id') subBrokerId?: string) {
    return this.bankAccountsService.getBankAccounts(subBrokerId);
  }

  @Post()
  async addBankAccount(@Body() payload: any) {
    return this.bankAccountsService.addBankAccount(payload);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDto: CreateBankAccountDto) {
    return await this.bankAccountsService.create(createDto);
  }
}
