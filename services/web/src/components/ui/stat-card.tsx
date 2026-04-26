import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const COLOR_MAP = {
  primary: {
    icon: 'bg-gradient-to-br from-primary/15 to-primary/5 text-primary',
    glow: 'after:bg-primary/5',
  },
  teal: {
    icon: 'bg-gradient-to-br from-teal-100 to-teal-50 text-teal-600',
    glow: 'after:bg-teal-50',
  },
  blue: {
    icon: 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600',
    glow: 'after:bg-blue-50',
  },
  amber: {
    icon: 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600',
    glow: 'after:bg-amber-50',
  },
  emerald: {
    icon: 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600',
    glow: 'after:bg-emerald-50',
  },
  rose: {
    icon: 'bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600',
    glow: 'after:bg-rose-50',
  },
  violet: {
    icon: 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600',
    glow: 'after:bg-violet-50',
  },
  orange: {
    icon: 'bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600',
    glow: 'after:bg-orange-50',
  },
  indigo: {
    icon: 'bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600',
    glow: 'after:bg-indigo-50',
  },
  cyan: {
    icon: 'bg-gradient-to-br from-cyan-100 to-cyan-50 text-cyan-600',
    glow: 'after:bg-cyan-50',
  },
} as const;

export type StatColor = keyof typeof COLOR_MAP;

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
  className,
  to,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: StatColor;
  className?: string;
  to?: string;
}) {
  const c = COLOR_MAP[color];
  const content = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all duration-300',
        'shadow-[var(--shadow-stat)] hover:shadow-[var(--shadow-stat-hover)] hover:-translate-y-0.5',
        to && 'cursor-pointer',
        className,
      )}
    >
      {/* Decorative corner glow */}
      <div className={cn('absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100', c.glow)} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                'text-xs font-semibold',
                trend.positive ? 'text-success' : 'text-destructive',
              )}
            >
              {trend.positive ? '+' : ''}{trend.value}
            </p>
          )}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm', c.icon)}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (!to) return content;
  return (
    <Link to={to} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl">
      {content}
    </Link>
  );
}
