import { UserProfile } from '../../entities/user-profile.entity';

export class UserMapper {
    /**
     * Maps user profiles to a consistent role structure used in JWT payloads and profile responses
     */
    static mapRoles(profiles: UserProfile[]) {
        return profiles.map(p => ({
            id: p.id,
            role: p.role,
            tenant_id: p.tenant_id,
            company_id: p.company_id,
            company_name: p.company?.name || null,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
        }));
    }

    /**
     * Maps a list of user profiles for management views
     */
    static mapToSummary(p: UserProfile) {
        return {
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            email: p.email,
            role: p.role,
            is_active: p.is_active,
            created_at: p.created_at,
        };
    }
}
