import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { SubBroker } from '../../entities/sub-broker.entity';
import { Investor } from '../../entities/investor.entity';
import { CommissionMapping } from '../../entities/commission-mapping.entity';
import { InvestorMapping } from '../../entities/investor-mapping.entity';
import { UserProfile } from '../../entities/user-profile.entity';
import { UserMapper } from '../../common/utils/user.mapper';
import { CreateUserDto, CreateUserRole, UpdateSubBrokerDto } from './dto/user-management.dto';

@Injectable()
export class UserManagementService {
    private readonly logger = new Logger(UserManagementService.name);

    constructor(
        @InjectRepository(SubBroker)
        private readonly subBrokerRepo: Repository<SubBroker>,
        @InjectRepository(Investor)
        private readonly investorRepo: Repository<Investor>,
        @InjectRepository(CommissionMapping)
        private readonly commissionRepo: Repository<CommissionMapping>,
        @InjectRepository(InvestorMapping)
        private readonly investorMappingRepo: Repository<InvestorMapping>,
        @InjectRepository(UserProfile)
        private readonly userProfileRepo: Repository<UserProfile>,
        private readonly dataSource: DataSource,
    ) { }

    // ────────────── CREATE ──────────────

    async createUser(dto: CreateUserDto) {
        if (dto.role === CreateUserRole.SUB_BROKER) {
            return this.createSubBroker(dto);
        } else {
            return this.createInvestor(dto);
        }
    }

    private async createSubBroker(dto: CreateUserDto) {
        return await this.dataSource.transaction(async (manager) => {
            let path = '';
            const parentId = dto.parent_id && dto.parent_id !== "" ? dto.parent_id : null;

            if (parentId) {
                const parent = await manager.findOne(SubBroker, { where: { id: parentId } });
                if (!parent) throw new NotFoundException('Parent broker not found');
                path = parent.path ? `${parent.path}/${parent.id}` : parent.id;
            }

            const subBroker = manager.create(SubBroker, {
                name: dto.name,
                arn_id: dto.arn,
                parent_id: parentId,
                path: path || undefined,
                company_id: dto.company_id,
            } as any);

            const savedBroker = await manager.save(SubBroker, subBroker);

            if (dto.share_percentage !== undefined && parentId) {
                const commission = manager.create(CommissionMapping, {
                    broker_id: parentId,
                    sub_broker_id: savedBroker.id,
                    share_percentage: dto.share_percentage,
                });
                await manager.save(CommissionMapping, commission);
            }

            return savedBroker;
        });
    }

    private async createInvestor(dto: CreateUserDto) {
        const parentId = dto.parent_id && dto.parent_id !== "" ? dto.parent_id : null;
        if (!parentId) {
            throw new BadRequestException('Investor must have a parent sub-broker');
        }

        const parentBroker = await this.subBrokerRepo.findOne({ where: { id: parentId } });
        if (!parentBroker) {
            throw new NotFoundException('Parent sub-broker not found');
        }

        const companyId = "78097b6a-9366-4e5c-9c71-c918c8e23927";

        const investor = this.investorRepo.create({
            name: dto.name,
            mobile: dto.phone_number,
            pan: 'TEMP_' + Math.random().toString(36).substring(7).toUpperCase(),
            company_id: companyId,
        } as any);

        return await this.investorRepo.save(investor);
    }

    // ────────────── READ ──────────────

    async getSubBrokerById(id: string) {
        const broker = await this.subBrokerRepo.findOne({
            where: { id },
            relations: ['parent', 'children'],
        });

        if (!broker) {
            throw new NotFoundException('Sub-broker not found');
        }

        // Get commission mapping where this broker is the sub_broker
        const commissionAsSubBroker = await this.commissionRepo.findOne({
            where: { sub_broker_id: id },
            relations: ['broker'],
        });

        // Get commission mappings where this broker is the parent
        const commissionAsParent = await this.commissionRepo.find({
            where: { broker_id: id },
            relations: ['sub_broker'],
        });

        // Count investors mapped under this broker's hierarchy
        const childBrokerIds = await this.getDescendantBrokerIds(id);
        const allBrokerIds = [id, ...childBrokerIds];

        return {
            ...broker,
            share_percentage: commissionAsSubBroker?.share_percentage || null,
            parent_broker_name: commissionAsSubBroker?.broker?.name || null,
            sub_broker_commissions: commissionAsParent.map(c => ({
                sub_broker_id: c.sub_broker_id,
                sub_broker_name: c.sub_broker?.name || null,
                share_percentage: c.share_percentage,
            })),
            total_children: broker.children?.length || 0,
        };
    }

    async getAllUsers(userSnapshot?: any) {
        const companyId = userSnapshot?.roles?.find((r: any) => r.company_id)?.company_id || userSnapshot?.company_id;

        // Fetch all brokers for the company
        let brokers = await this.subBrokerRepo.find({
            where: companyId ? { company_id: companyId } : undefined,
            relations: ['parent'],
            order: { created_at: 'ASC' },
        });

        // Fetch all commission mappings in a single query
        const commissions = await this.commissionRepo.find();
        const commissionMap = new Map<string, number>();
        commissions.forEach(c => {
            commissionMap.set(c.sub_broker_id, Number(c.share_percentage));
        });

        // Enrich brokers with commission data
        const sub_brokers = brokers.map(b => ({
            id: b.id,
            name: b.name,
            arn_id: b.arn_id,
            parent_id: b.parent_id,
            parent_name: b.parent?.name || null,
            share_percentage: commissionMap.get(b.id) ?? null,
            created_at: b.created_at,
        }));

        return {
            sub_brokers,
        };
    }

    async getPaginatedUsers(companyId: string, page: number = 1, limit: number = 10, search?: string) {
        const query = this.userProfileRepo.createQueryBuilder('profile')
            .leftJoinAndSelect('profile.user', 'user')
            .where('profile.company_id = :companyId', { companyId });

        if (search) {
            query.andWhere(
                '(profile.first_name ILIKE :search OR profile.last_name ILIKE :search OR profile.email ILIKE :search)',
                { search: `%${search}%` }
            );
        }

        const [users, total] = await query
            .orderBy('profile.created_at', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return {
            users: users.map(UserMapper.mapToSummary),
            total,
            page,
            limit
        };
    }

    async getHierarchy(userSnapshot?: any) {
        const companyId = userSnapshot?.roles?.find((r: any) => r.company_id)?.company_id || userSnapshot?.company_id;

        const brokers = await this.subBrokerRepo.find({
            where: companyId ? { company_id: companyId } : undefined,
            relations: ['parent', 'children'],
        });

        // Fetch all commissions for share_percentage display
        const commissions = await this.commissionRepo.find();
        const commissionMap = new Map<string, number>();
        commissions.forEach(c => {
            commissionMap.set(c.sub_broker_id, Number(c.share_percentage));
        });

        const brokerMap = new Map<string, any>();
        brokers.forEach(b => brokerMap.set(b.id, {
            id: b.id,
            name: b.name,
            arn_id: b.arn_id,
            parent_id: b.parent_id,
            share_percentage: commissionMap.get(b.id) ?? null,
            children: [],
        }));

        const roots: any[] = [];
        for (const b of brokers) {
            if (b.parent_id && brokerMap.has(b.parent_id)) {
                brokerMap.get(b.parent_id).children.push(brokerMap.get(b.id));
            } else {
                roots.push(brokerMap.get(b.id));
            }
        }

        return roots;
    }

    // ────────────── UPDATE ──────────────

    async updateSubBroker(id: string, dto: UpdateSubBrokerDto) {
        const broker = await this.subBrokerRepo.findOne({ where: { id } });
        if (!broker) {
            throw new NotFoundException('Sub-broker not found');
        }

        return await this.dataSource.transaction(async (manager) => {
            // Update basic fields
            const updateData: Partial<SubBroker> = {};
            if (dto.name !== undefined) updateData.name = dto.name;
            if (dto.arn !== undefined) updateData.arn_id = dto.arn;

            // Handle parent change (re-parenting)
            if (dto.parent_id !== undefined) {
                const newParentId = dto.parent_id && dto.parent_id !== "" ? dto.parent_id : null;

                // Prevent self-referencing
                if (newParentId === id) {
                    throw new BadRequestException('A broker cannot be its own parent');
                }

                // Prevent circular hierarchy
                if (newParentId) {
                    const isDescendant = await this.isDescendantOf(newParentId, id);
                    if (isDescendant) {
                        throw new BadRequestException('Cannot set a descendant as parent (circular hierarchy)');
                    }

                    const newParent = await manager.findOne(SubBroker, { where: { id: newParentId } });
                    if (!newParent) throw new NotFoundException('New parent broker not found');

                    updateData.parent_id = newParentId;
                    updateData.path = newParent.path ? `${newParent.path}/${newParent.id}` : newParent.id;
                } else {
                    updateData.parent_id = null as any;
                    updateData.path = '' as any;
                }
            }

            if (Object.keys(updateData).length > 0) {
                await manager.update(SubBroker, id, updateData);
            }

            // Update commission share percentage
            if (dto.share_percentage !== undefined) {
                const effectiveParentId = dto.parent_id !== undefined
                    ? (dto.parent_id && dto.parent_id !== "" ? dto.parent_id : null)
                    : broker.parent_id;

                if (effectiveParentId) {
                    // Create or update mapping for sub-broker relative to its parent
                    const existingCommission = await manager.findOne(CommissionMapping, {
                        where: { sub_broker_id: id },
                    });

                    if (existingCommission) {
                        await manager.update(CommissionMapping, existingCommission.id, {
                            broker_id: effectiveParentId,
                            share_percentage: dto.share_percentage,
                        });
                    } else {
                        const newCommission = manager.create(CommissionMapping, {
                            broker_id: effectiveParentId,
                            sub_broker_id: id,
                            share_percentage: dto.share_percentage,
                        });
                        await manager.save(CommissionMapping, newCommission);
                    }
                } else {
                    // If no parent (Master), delete any existing share mapping
                    await manager.delete(CommissionMapping, { sub_broker_id: id });
                }
            } else if (dto.parent_id !== undefined && (dto.parent_id === "" || dto.parent_id === null)) {
                // If parent removed but share not specified, also cleanup for safety
                await manager.delete(CommissionMapping, { sub_broker_id: id });
            }

            // If parent changed, rebuild paths for all descendants
            if (dto.parent_id !== undefined) {
                await this.rebuildDescendantPaths(manager, id);
            }

            // Fetch and return the updated broker
            const updated = await manager.findOne(SubBroker, {
                where: { id },
                relations: ['parent', 'children'],
            });

            const commission = await manager.findOne(CommissionMapping, {
                where: { sub_broker_id: id },
            });

            return {
                ...updated,
                share_percentage: commission ? Number(commission.share_percentage) : null,
            };
        });
    }

    // ────────────── DELETE (Soft Deactivation) ──────────────

    async deleteSubBroker(id: string) {
        const broker = await this.subBrokerRepo.findOne({
            where: { id },
            relations: ['children'],
        });

        if (!broker) {
            throw new NotFoundException('Sub-broker not found');
        }

        if (broker.children && broker.children.length > 0) {
            throw new BadRequestException(
                `Cannot delete broker "${broker.name}" because it has ${broker.children.length} child broker(s). ` +
                'Please reassign or remove child brokers first.'
            );
        }

        return await this.dataSource.transaction(async (manager) => {
            // Remove commission mappings
            await manager.delete(CommissionMapping, { sub_broker_id: id });
            await manager.delete(CommissionMapping, { broker_id: id });

            // Delete the broker
            await manager.delete(SubBroker, id);

            return { message: `Sub-broker "${broker.name}" deleted successfully` };
        });
    }

    // ────────────── HELPERS ──────────────

    /**
     * Check if `potentialDescendantId` is a descendant of `ancestorId`
     */
    private async isDescendantOf(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
        const descendant = await this.subBrokerRepo.findOne({
            where: { id: potentialDescendantId },
        });
        if (!descendant) return false;

        // Check path-based hierarchy
        if (descendant.path) {
            return descendant.path.includes(ancestorId);
        }

        // Walk up the tree
        let currentId: string | null = descendant.parent_id;
        const visited = new Set<string>();
        while (currentId) {
            if (currentId === ancestorId) return true;
            if (visited.has(currentId)) break; // circular safety
            visited.add(currentId);
            const parent = await this.subBrokerRepo.findOne({ where: { id: currentId } });
            currentId = parent?.parent_id ?? null;
        }
        return false;
    }

    /**
     * Get all descendant broker IDs for a given broker
     */
    private async getDescendantBrokerIds(brokerId: string): Promise<string[]> {
        const allBrokers = await this.subBrokerRepo.find();
        const ids: string[] = [];
        const queue = [brokerId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const children = allBrokers.filter(b => b.parent_id === currentId);
            for (const child of children) {
                ids.push(child.id);
                queue.push(child.id);
            }
        }
        return ids;
    }

    /**
     * Rebuild path values for all descendants after a re-parenting
     */
    private async rebuildDescendantPaths(manager: any, brokerId: string) {
        const broker = await manager.findOne(SubBroker, { where: { id: brokerId } });
        if (!broker) return;

        const children = await manager.find(SubBroker, { where: { parent_id: brokerId } });
        for (const child of children) {
            const newPath = broker.path ? `${broker.path}/${broker.id}` : broker.id;
            await manager.update(SubBroker, child.id, { path: newPath });
            // Recursively update children
            await this.rebuildDescendantPaths(manager, child.id);
        }
    }
}
