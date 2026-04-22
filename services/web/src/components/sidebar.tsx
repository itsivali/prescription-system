import { Link, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Stethoscope,
  Pill,
  ShieldCheck,
  ClipboardList,
  Users,
  Package,
  FileText,
  BarChart3,
  Settings,
  Activity,
  Heart,
  ScanLine,
} from 'lucide-react';

type NavGroup = {
  label: string;
  items: { label: string; href: string; icon: React.ReactNode }[];
};

const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  DOCTOR: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/doctor', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Clinical',
      items: [
        { label: 'Patients', href: '/doctor/patients', icon: <Users className="h-4 w-4" /> },
        { label: 'Encounters', href: '/doctor/encounters', icon: <Activity className="h-4 w-4" /> },
        { label: 'Prescriptions', href: '/doctor/prescriptions', icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
  ],
  PHARMACIST: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/pharmacist', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Pharmacy',
      items: [
        { label: 'Verify & Dispense', href: '/pharmacist/scan', icon: <ScanLine className="h-4 w-4" /> },
        { label: 'Dispensations', href: '/pharmacist/dispensations', icon: <Pill className="h-4 w-4" /> },
        { label: 'Inventory', href: '/pharmacist/inventory', icon: <Package className="h-4 w-4" /> },
      ],
    },
  ],
  ADMIN: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/admin', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Management',
      items: [
        { label: 'Users', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
        { label: 'Billing', href: '/admin/billing', icon: <ClipboardList className="h-4 w-4" /> },
        { label: 'Audit Log', href: '/admin/audit', icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Settings', href: '/admin/settings', icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ],
};

const ROLE_META: Record<Role, { label: string; icon: React.ReactNode; color: string }> = {
  DOCTOR: {
    label: 'Doctor Portal',
    icon: <Stethoscope className="h-3.5 w-3.5" />,
    color: 'text-teal-600',
  },
  PHARMACIST: {
    label: 'Pharmacy Portal',
    icon: <Pill className="h-3.5 w-3.5" />,
    color: 'text-amber-600',
  },
  ADMIN: {
    label: 'Admin Portal',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    color: 'text-blue-600',
  },
};

export function Sidebar() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) return null;

  const groups = NAV_BY_ROLE[user.role];
  const meta = ROLE_META[user.role];

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-sm">
          <Heart className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
            MedFlow
          </p>
          <div className={cn('flex items-center gap-1 text-[11px] font-medium', meta.color)}>
            {meta.icon}
            {meta.label}
          </div>
        </div>
      </div>

      <div className="mx-4 h-px bg-sidebar-border" />

      {/* ── Navigation ────────────────────────────────────────── */}
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-5 px-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== `/${user.role.toLowerCase()}` &&
                      pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'transition-colors',
                          isActive
                            ? 'text-sidebar-accent-foreground'
                            : 'text-sidebar-muted group-hover:text-sidebar-foreground',
                        )}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="mx-4 h-px bg-sidebar-border" />
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {user.fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-sidebar-foreground">{user.fullName}</p>
          <p className="truncate text-[11px] text-sidebar-muted">{user.email}</p>
        </div>
      </div>
    </aside>
  );
}
