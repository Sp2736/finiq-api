import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/entities/user-profile.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
