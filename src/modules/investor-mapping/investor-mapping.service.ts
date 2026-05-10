import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import { InvestorMappingHistory, MappingAction } from 'src/entities/investor-mapping-history.entity';
import { Investor } from 'src/entities/investor.entity';
import { SubBroker } from 'src/entities/sub-broker.entity';
import { UserProfile, UserRole } from 'src/entities/user-profile.entity';
import { AssignInvestorsDto, UnassignInvestorsDto } from './dto/investor-mapping.dto';

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
    ) { }

    async assignInvestors(adminPayload: any, dto: AssignInvestorsDto) {
        const adminRole = adminPayload.roles.find(r => r.role === UserRole.COMPANY_ADMIN);
        if (!adminRole || !adminRole.company_id) {
            throw new BadRequestException('Invalid Company Admin context');
        }
        const companyId = adminRole.company_id;
        const performedById = adminRole.id;

        // Verify Target Broker exists and belongs to the same company
        const targetBroker = await this.subBrokerRepo.findOne({
            where: { id: dto.sub_broker_id, company_id: companyId }
        });
        if (!targetBroker) {
            throw new NotFoundException('Target broker not found in your company');
        }

        // Verify Investors belong to same company
        const investors = await this.investorRepo.find({
            where: { id: In(dto.investor_ids), company_id: companyId }
        });
        if (investors.length !== dto.investor_ids.length) {
            throw new BadRequestException('Some investors not found or do not belong to your company');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const investor of investors) {
                // 1. Deactivate ANY existing active mappings for this investor
                // (assuming 1-to-1 active mapping per business requirement)
                await queryRunner.manager.update(InvestorMapping,
                    { investor_id: investor.id, is_active: true },
                    { is_active: false }
                );

                // 2. Find if we already have a record for THIS specific (investor, broker) pair
                let mapping = await queryRunner.manager.findOne(InvestorMapping, {
                    where: {
                        investor_id: investor.id,
                        sub_broker_id: targetBroker.id,
                        company_id: companyId
                    }
                });

                if (mapping) {
                    mapping.is_active = true;
                    await queryRunner.manager.save(InvestorMapping, mapping);
                } else {
                    mapping = new InvestorMapping();
                    mapping.company_id = companyId;
                    mapping.investor_id = investor.id;
                    mapping.sub_broker_id = targetBroker.id;
                    mapping.is_active = true;
                    await queryRunner.manager.save(InvestorMapping, mapping);
                }

                // 3. Log History
                await this.logHistory(queryRunner, companyId, investor.id, targetBroker.id, MappingAction.ASSIGNED, performedById);
            }

            await queryRunner.commitTransaction();
            return { success: true, message: 'Investors assigned successfully' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Assignment failed for sub_broker ${dto.sub_broker_id}: ${error.message}`, error.stack);
            throw new BadRequestException(`Mapping failed: ${error.message}`);
        } finally {
            await queryRunner.release();
        }
    }

    async unassignInvestors(adminPayload: any, dto: UnassignInvestorsDto) {
        const adminRole = adminPayload.roles.find(r => r.role === UserRole.COMPANY_ADMIN);
        if (!adminRole || !adminRole.company_id) {
            throw new BadRequestException('Invalid Company Admin context');
        }
        const companyId = adminRole.company_id;
        const performedById = adminPayload.id; // Corrected: Use primary user profile ID

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const investorId of dto.investor_ids) {
                const mapping = await queryRunner.manager.findOne(InvestorMapping, {
                    where: {
                        investor_id: investorId,
                        sub_broker_id: dto.sub_broker_id,
                        company_id: companyId,
                        is_active: true
                    }
                });

                if (mapping) {
                    mapping.is_active = false;
                    await queryRunner.manager.save(InvestorMapping, mapping);

                    await this.logHistory(queryRunner, companyId, investorId, dto.sub_broker_id, MappingAction.UNASSIGNED, performedById);
                }
            }

            await queryRunner.commitTransaction();
            return { success: true, message: 'Investors unassigned successfully' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Unassignment failed: ${error.message}`, error.stack);
            throw new BadRequestException(`Unmapping failed: ${error.message}`);
        } finally {
            await queryRunner.release();
        }
    }

    private async logHistory(queryRunner, companyId, investorId, subBrokerId, action: MappingAction, performedById) {
        const history = new InvestorMappingHistory();
        history.company_id = companyId;
        history.investor_id = investorId;
        history.sub_broker_id = subBrokerId;
        history.action = action;
        history.performed_by_id = performedById;
        await queryRunner.manager.save(InvestorMappingHistory, history);
    }
}
