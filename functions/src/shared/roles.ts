import type { Role } from '../../../shared/contracts';
export function hasRole(roles: readonly Role[], required: Role): boolean {
  return roles.includes(required) || (required === 'USER' && roles.includes('DRIVER'));
}
