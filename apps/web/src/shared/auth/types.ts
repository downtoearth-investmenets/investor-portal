export type UserRole = 'admin' | 'investor';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  investorProfileId?: string;
  entityName?: string;
}

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';
