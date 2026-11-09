'use client';

import type { ReactNode } from 'react';
import { FileDown, Landmark, LayoutDashboard } from 'lucide-react';
import { RoleGate } from '@/shared/auth';
import { AppShell, type NavItem } from '@/shared/layout/AppShell';

const NAV_ITEMS: NavItem[] = [
  { href: '/investor/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/investor/loans', label: 'My notes', icon: Landmark },
  { href: '/investor/reports', label: 'Reports', icon: FileDown }
];

export default function InvestorLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate area="investor">
      <AppShell navItems={NAV_ITEMS} areaLabel="Investor portal" accountHref="/investor/account">
        {children}
      </AppShell>
    </RoleGate>
  );
}
