import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const COLOR_MAP = {
  primary: 'bg-primary/10 text-primary',
  teal: 'bg-teal-50 text-teal-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  cyan: 'bg-cyan-50 text-cyan-600',
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
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: StatColor;
  className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', COLOR_MAP[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
