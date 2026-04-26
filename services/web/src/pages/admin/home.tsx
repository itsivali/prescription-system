import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  Users,
  FileText,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  DollarSign,
} from 'lucide-react';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1.5">
        <div className="h-6 w-40 rounded animate-skeleton" />
        <div className="h-3.5 w-56 rounded animate-skeleton" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-24 rounded animate-skeleton" />
                <div className="h-6 w-12 rounded animate-skeleton" />
              </div>
              <div className="h-10 w-10 rounded-xl animate-skeleton" />
            </div>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3"><div className="h-4 w-32 rounded animate-skeleton" /></CardHeader>
            <CardContent className="space-y-2.5">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5">
                  <div className="h-8 w-8 rounded-lg animate-skeleton" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-24 rounded animate-skeleton" />
                    <div className="h-2.5 w-32 rounded animate-skeleton" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminHome() {
  const { data: audit, isLoading: loadingAudit } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: async () => {
      const res = await api.get('/audit', { params: { take: 8 } });
      return res.data;
    },
  });

  const { data: invoices, isLoading: loadingInv } = useQuery({
    queryKey: ['invoices', 'overview'],
    queryFn: async () => {
      const res = await api.get('/billing/invoices', { params: { take: 5 } });
      return res.data;
    },
  });

  const { data: doctors, isLoading: loadingDoc } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const res = await api.get('/doctors');
      return res.data;
    },
  });

  const initialLoading = loadingAudit && loadingInv && loadingDoc;

  const onShiftCount =
    doctors?.items?.filter(
      (d: { shiftEndsAt: string | null }) =>
        d.shiftEndsAt && new Date(d.shiftEndsAt) > new Date(),
    ).length ?? 0;

  if (initialLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-sm text-muted-foreground">System overview and administration</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Doctors On Shift"
          value={onShiftCount}
          subtitle={`${doctors?.items?.length ?? 0} total registered`}
          icon={<Users className="h-5 w-5" />}
          to="/admin/users"
        />
        <StatCard
          title="Open Invoices"
          value={invoices?.total ?? 0}
          icon={<DollarSign className="h-5 w-5" />}
          to="/admin/billing"
        />
        <StatCard
          title="Audit Events"
          value={audit?.items?.length ?? 0}
          subtitle="Most recent"
          icon={<FileText className="h-5 w-5" />}
          to="/admin/audit"
        />
        <StatCard
          title="System"
          value="Healthy"
          subtitle="All services operational"
          icon={<ShieldCheck className="h-5 w-5" />}
          to="/admin/settings"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Audit log */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <Link to="/admin/audit">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!audit?.items?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FileText className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No recent events</p>
              </div>
            ) : (
              <div className="space-y-2">
                {audit.items.slice(0, 5).map((event: Record<string, unknown>) => (
                  <div key={String(event.id)} className="flex items-center justify-between rounded-xl border border-border/50 p-3.5 transition-all duration-200 hover:bg-accent/30 hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{event.action as string}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.entity as string} &middot;{' '}
                          {new Date(event.occurredAt as string).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {event.actorRole as string}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Invoices</CardTitle>
            <Link to="/admin/billing">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!invoices?.items?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.items.map((inv: Record<string, unknown>) => (
                  <div key={inv.id as string} className="flex items-center justify-between rounded-xl border border-border/50 p-3.5 transition-all duration-200 hover:bg-accent/30 hover:shadow-sm">
                    <div>
                      <p className="text-sm font-medium">
                        {(inv.patient as { fullName: string })?.fullName ?? 'Patient'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${((inv.totalCents as number) / 100).toFixed(2)} &middot;{' '}
                        {new Date(inv.createdAt as string).toLocaleDateString()}
                      </p>
                    </div>
                    <InvoiceStatusBadge status={inv.status as string} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    OPEN: 'bg-primary/10 text-primary border-0',
    PAID: 'bg-success/10 text-success border-0',
    WRITTEN_OFF: 'bg-muted text-muted-foreground border-0',
  };
  return (
    <Badge className={`${config[status] ?? config.OPEN} text-[11px]`}>{status}</Badge>
  );
}
