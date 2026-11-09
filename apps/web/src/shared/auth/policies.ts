import type { UserRole } from './types';

export type PortalArea = 'admin' | 'investor';

export const canEnterArea = (role: UserRole | undefined, area: PortalArea) => role === area;

export const homePathFor = (role: UserRole) => (role === 'admin' ? '/admin/dashboard' : '/investor/dashboard');
