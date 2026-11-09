'use client';

import type { ReactNode } from 'react';
import { FileDown, Landmark, LayoutDashboard, Users } from 'lucide-react';
import { RoleGate } from '@/shared/auth';
import { AppShell, type NavItem } from '@/shared/layout/AppShell';

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Portfolio', icon: LayoutDashboard },
  { href: '/admin/investors', label: 'Investors', icon: Users },
  { href: '/admin/loans', label: 'Notes', icon: Landmark },
  { href: '/admin/reports', label: 'Reports', icon: FileDown }
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate area="admin">
      <AppShell navItems={NAV_ITEMS} areaLabel="Admin" accountHref="/admin/account">
        {children}
      </AppShell>
    </RoleGate>
  );
}
