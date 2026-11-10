'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useSession } from '@/shared/auth';
import { BrandMark } from '@/shared/ui/Brand';
import { cn } from '@/shared/lib/cn';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AppShellProps {
  navItems: NavItem[];
  areaLabel: string;
  accountHref: string;
  children: ReactNode;
}

const ITEM = 48; // px, height of a nav item
const GAP = 8; // px, space between nav items
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(word => word && word.toLowerCase() !== 'and')
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join('');

/** Label that fades and slides in as the rail widens. Always readable by screen readers. */
function RailLabel({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'min-w-0 truncate whitespace-nowrap transition-[opacity,transform] duration-300 motion-reduce:transition-none',
        EASE,
        show ? 'translate-x-0 opacity-100 delay-75' : '-translate-x-1.5 opacity-0',
        className
      )}
    >
      {children}
    </span>
  );
}

export function AppShell({ navItems, areaLabel, accountHref, children }: AppShellProps) {
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const handleSignOut = () => {
    signOut();
    router.replace('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeIndex = navItems.findIndex(item => isActive(item.href));
  const indicatorY = Math.max(activeIndex, 0) * (ITEM + GAP);

  const railButton = cn(
    'group/item relative flex h-12 items-center gap-3 rounded-full pl-[14px] pr-4 text-sm font-medium outline-none transition-colors duration-200',
    'focus-visible:ring-2 focus-visible:ring-sage-200'
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden print:!hidden">
        <Link href={navItems[0]?.href ?? '/'} className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="text-sm font-semibold">Down to Earth</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="rounded-lg p-2 text-ink hover:bg-sand"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Desktop floating rail */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'group/sidebar fixed bottom-3 left-3 top-3 z-40 hidden flex-col rounded-[28px] bg-forest px-3 py-4 text-white shadow-[0_10px_30px_rgba(20,32,27,0.18)] transition-[width] duration-300 motion-reduce:transition-none lg:flex print:!hidden',
          EASE,
          expanded ? 'w-44' : 'w-[72px]'
        )}
      >
        <button
          type="button"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          onClick={() => setExpanded(open => !open)}
          className="absolute right-0 top-1/2 z-10 grid h-11 w-8 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full opacity-0 outline-none transition-opacity duration-200 group-hover/sidebar:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sage-700 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
        >
          <span className="grid h-9 w-6 place-items-center rounded-full border border-white/20 bg-forest text-sage-200 shadow-md">
            {expanded ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          </span>
        </button>
        <Link href={navItems[0]?.href ?? '/'} className="mb-8 flex h-12 items-center gap-2 pl-[6px]" aria-label="Down to Earth home">
          <BrandMark className="h-9 w-9 rounded-2xl bg-sage-400" />
          <span className="flex min-w-0 flex-col leading-tight">
            <RailLabel show={expanded} className="text-sm font-semibold">
              Down to Earth
            </RailLabel>
            <RailLabel show={expanded} className="text-[11px] text-white/50">
              {areaLabel}
            </RailLabel>
          </span>
        </Link>

        <nav aria-label="Main" className="relative flex-1">
          {activeIndex >= 0 && (
            <>
              <span
                aria-hidden
                className={cn('absolute left-0 right-0 h-12 rounded-full bg-sage-200 shadow-[0_0_28px_rgba(105,162,165,0.55)] transition-transform duration-500', EASE)}
                style={{ transform: `translateY(${indicatorY}px)` }}
              />
              <span
                aria-hidden
                className={cn('absolute -right-3 h-5 w-1.5 rounded-l-full bg-sage-200 transition-transform duration-500', EASE)}
                style={{ transform: `translateY(${indicatorY + 14}px)` }}
              />
            </>
          )}
          <ul className="relative flex flex-col" style={{ gap: GAP }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={expanded ? undefined : item.label}
                    className={cn(railButton, active ? 'text-forest' : 'text-white/60 hover:bg-white/[0.06] hover:text-white')}
                  >
                    <Icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover/item:scale-110" aria-hidden />
                    <RailLabel show={expanded}>{item.label}</RailLabel>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-4">
          <Link
            href={accountHref}
            aria-current={isActive(accountHref) ? 'page' : undefined}
            title={user?.fullName ?? 'Account'}
            className={cn(
              'flex h-12 items-center gap-2 rounded-full pl-[6px] pr-2 outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-sage-200',
              isActive(accountHref) && 'bg-white/[0.08]'
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold" aria-hidden>
              {initials(user?.fullName)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <RailLabel show={expanded} className="text-sm font-medium">
                {user?.fullName}
              </RailLabel>
              <RailLabel show={expanded} className="text-[11px] text-white/50">
                {user?.entityName ?? 'Account'}
              </RailLabel>
            </span>
          </Link>
          <button type="button" onClick={handleSignOut} title={expanded ? undefined : 'Sign out'} className={cn(railButton, 'text-white/60 hover:bg-white/[0.06] hover:text-white')}>
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            <RailLabel show={expanded}>Sign out</RailLabel>
          </button>
        </div>
      </aside>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-3 left-3 flex w-72 max-w-[85vw] animate-slide-in-left flex-col rounded-[28px] bg-forest px-3 py-4 text-white shadow-pop">
            <div className="mb-8 flex items-center justify-between pl-1.5">
              <div className="flex items-center gap-3">
                <BrandMark className="h-9 w-9 rounded-2xl bg-sage-400" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Down to Earth</p>
                  <p className="text-[11px] text-white/50">{areaLabel}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-full p-2 text-white/70 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main" className="flex-1">
              <ul className="flex flex-col gap-2">
                {[...navItems, { href: accountHref, label: 'Account', icon: navItems[0].icon }].map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const isAccount = index === navItems.length;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(railButton, active ? 'bg-sage-200 text-forest' : 'text-white/70 hover:bg-white/[0.06] hover:text-white')}
                      >
                        {isAccount ? (
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-semibold">{initials(user?.fullName)}</span>
                        ) : (
                          <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        )}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <button type="button" onClick={handleSignOut} className={cn(railButton, 'text-white/70 hover:bg-white/[0.06] hover:text-white')}>
              <LogOut className="h-5 w-5 shrink-0" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}

      <div className={cn('transition-[padding] duration-300 motion-reduce:transition-none print:!pl-0', EASE, expanded ? 'lg:pl-[200px]' : 'lg:pl-[96px]')}>
        <main key={pathname} className="mx-auto w-full max-w-[1680px] animate-rise px-5 py-8 sm:px-8 lg:px-10 lg:py-10 2xl:px-14 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

