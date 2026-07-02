import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubBroker } from 'src/entities/sub-broker.entity';
import { UserRole } from 'src/entities/user-profile.entity';

export interface HierarchyAccessContext {
  /** Present only when the caller is scoped to a single company
   *  (COMPANY_ADMIN, BROKER, SUB_BROKER). null for FINIQ_ADMIN/TENANT_ADMIN,
   *  who must use allowedCompanyIds instead. */
  companyId: string | null;
  /** Tenant/company axis. null = every company on the platform (FINIQ_ADMIN).
   *  string[] = the exact set of company_ids this caller may touch
   *  (TENANT_ADMIN: every company under their tenant_id).
   *  For COMPANY_ADMIN/BROKER/SUB_BROKER this is always exactly [companyId]. */
  allowedCompanyIds: string[] | null;
  tenantId: string | null; // set for TENANT_ADMIN; informational elsewhere
  performedById: string; // user_profiles.id of the caller — for audit trails
  callerRole: UserRole;
  callerSubBrokerId: string | null; // null unless BROKER/SUB_BROKER
  /** Hierarchy axis. null = unrestricted within whichever company is in scope
   *  (COMPANY_ADMIN and above). Otherwise: exact set of sub_broker_ids the
   *  caller may act on/see — always includes their own id plus every descendant. */
  allowedSubBrokerIds: string[] | null;
}

@Injectable()
export class HierarchyAccessService {
  private readonly logger = new Logger(HierarchyAccessService.name);

  constructor(
    @InjectRepository(SubBroker)
    private readonly subBrokerRepo: Repository<SubBroker>,
  ) {}

  /** The one and only place in the codebase allowed to answer
   *  "what is this caller allowed to see/touch". Every module must call this
   *  instead of writing its own version. Fails closed on anything unrecognized. */
  async resolveAccess(userPayload: any): Promise<HierarchyAccessContext> {
    const roles: any[] = userPayload?.roles || [];

    // Platform-level: FINIQ_ADMIN. Every company, every tenant. Used for
    // client onboarding (creating companies/ARNs).
    const finiqAdmin = roles.find((r) => r.role === UserRole.FINIQ_ADMIN);
    if (finiqAdmin) {
      return {
        companyId: null,
        allowedCompanyIds: null, // null = unrestricted, ALL companies
        tenantId: null,
        performedById: finiqAdmin.id,
        callerRole: UserRole.FINIQ_ADMIN,
        callerSubBrokerId: null,
        allowedSubBrokerIds: null,
      };
    }

    // Tenant-level: TENANT_ADMIN. All companies under their own tenant_id.
    const tenantAdmin = roles.find((r) => r.role === UserRole.TENANT_ADMIN);
    if (tenantAdmin) {
      if (!tenantAdmin.tenant_id)
        throw new BadRequestException('Invalid Tenant Admin context');
      const companies = await this.subBrokerRepo.manager
        .getRepository('Company')
        .find({ where: { tenant_id: tenantAdmin.tenant_id }, select: ['id'] });
      return {
        companyId: null,
        allowedCompanyIds: companies.map((c: any) => c.id),
        tenantId: tenantAdmin.tenant_id,
        performedById: tenantAdmin.id,
        callerRole: UserRole.TENANT_ADMIN,
        callerSubBrokerId: null,
        allowedSubBrokerIds: null,
      };
    }

    // INVESTOR role explicitly fails closed here, because it doesn't use the
    // broker hierarchy system.
    const investorRole = roles.find((r) => r.role === UserRole.INVESTOR);
    if (investorRole) {
      throw new ForbiddenException(
        'Investor accounts do not use this access path. Please use the investor login.',
      );
    }

    // Company-level: COMPANY_ADMIN. Unrestricted within exactly one company.
    const companyAdmin = roles.find((r) => r.role === UserRole.COMPANY_ADMIN);
    if (companyAdmin) {
      if (!companyAdmin.company_id)
        throw new BadRequestException('Invalid Company Admin context');
      return {
        companyId: companyAdmin.company_id,
        allowedCompanyIds: [companyAdmin.company_id],
        tenantId: companyAdmin.tenant_id ?? null,
        performedById: companyAdmin.id,
        callerRole: UserRole.COMPANY_ADMIN,
        callerSubBrokerId: null,
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
        // JWT predates the sub_broker_id claim, or the account has no linked
        // SubBroker row. Fail closed — force re-login.
        throw new ForbiddenException(
          'Your account is not linked to a broker record. Please log out and log back in; ' +
            'if the issue persists, contact your administrator.',
        );
      }

      const descendantIds = await this.getDescendantSubBrokerIds(
        brokerRole.company_id,
        brokerRole.sub_broker_id,
      );

      return {
        companyId: brokerRole.company_id,
        allowedCompanyIds: [brokerRole.company_id],
        tenantId: brokerRole.tenant_id ?? null,
        performedById: brokerRole.id,
        callerRole: brokerRole.role,
        callerSubBrokerId: brokerRole.sub_broker_id,
        allowedSubBrokerIds: [brokerRole.sub_broker_id, ...descendantIds],
      };
    }

    throw new ForbiddenException(
      'You do not have permission to access this resource.',
    );
  }

  /** Checks the tenant/company axis only — call this before touching a
   *  specific company's data whenever the caller might be FINIQ_ADMIN or
   *  TENANT_ADMIN. */
  assertCompanyAllowed(access: HierarchyAccessContext, companyId: string) {
    if (access.allowedCompanyIds === null) return; // FINIQ_ADMIN, unrestricted
    if (!access.allowedCompanyIds.includes(companyId)) {
      throw new ForbiddenException(
        'You do not have permission for this company.',
      );
    }
  }

  /** Descendant lookup using the materialized path column if available, else fallback to BFS. */
  async getDescendantSubBrokerIds(
    companyId: string,
    rootId: string,
  ): Promise<string[]> {
    // Attempt to use path column
    const rootBroker = await this.subBrokerRepo.findOne({
      where: { id: rootId, company_id: companyId },
      select: ['id', 'path'],
    });

    if (rootBroker && rootBroker.path) {
      const descendants = await this.subBrokerRepo
        .createQueryBuilder('sb')
        .select('sb.id')
        .where('sb.company_id = :companyId', { companyId })
        .andWhere('sb.path LIKE :pathPrefix', {
          pathPrefix: `${rootBroker.path}/%`,
        })
        .getMany();
      return descendants.map((d) => d.id);
    }

    // Fallback to BFS if path is empty (e.g. legacy data before path migration)
    this.logger.warn(
      `SubBroker ${rootId} does not have a path set. Falling back to BFS.`,
    );
    const all = await this.subBrokerRepo.find({
      where: { company_id: companyId },
      select: ['id', 'parent_id'],
    });
    const ids: string[] = [];
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const child of all.filter((b) => b.parent_id === current)) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }
    return ids;
  }

  /** Throws if the target sub_broker is outside the caller's allowed set. */
  assertSubBrokerAllowed(access: HierarchyAccessContext, subBrokerId: string) {
    if (access.allowedSubBrokerIds === null) return; // COMPANY_ADMIN, unrestricted
    if (!access.allowedSubBrokerIds.includes(subBrokerId)) {
      throw new ForbiddenException(
        'You do not have permission for this broker/sub-broker.',
      );
    }
  }

  /** Given an investor_id, checks whether the caller's allowed sub-broker set
   *  contains that investor's ACTIVE mapping. Use for single-investor endpoints */
  async assertInvestorAccess(
    access: HierarchyAccessContext,
    investorId: string,
    investorMappingRepo: Repository<any>,
  ): Promise<void> {
    // Tenant boundary first, always — regardless of role.
    // (Caller code must also verify investor.company_id === access.companyId.)
    if (access.allowedSubBrokerIds === null) return; // COMPANY_ADMIN
    const mapping = await investorMappingRepo.findOne({
      where: {
        investor_id: investorId,
        sub_broker_id: In(access.allowedSubBrokerIds),
        is_active: true,
      },
    });
    if (!mapping) {
      throw new ForbiddenException('You do not have access to this investor.');
    }
  }

  /** Convenience for building a TypeORM `where` fragment / QueryBuilder param
   *  set for list endpoints. Returns null when unrestricted. */
  scopeParam(access: HierarchyAccessContext): string[] | null {
    return access.allowedSubBrokerIds;
  }
}
