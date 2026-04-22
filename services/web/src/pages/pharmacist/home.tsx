import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  Pill,
  Package,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  ScanLine,
} from 'lucide-react';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-48 rounded animate-skeleton" />
          <div className="h-3.5 w-56 rounded animate-skeleton" />
        </div>
        <div className="h-10 w-40 rounded-lg animate-skeleton" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-20 rounded animate-skeleton" />
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
            <CardHeader className="pb-3"><div className="h-4 w-36 rounded animate-skeleton" /></CardHeader>
            <CardContent className="space-y-2.5">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5">
                  <div className="h-9 w-9 rounded-lg animate-skeleton" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 rounded animate-skeleton" />
                    <div className="h-2.5 w-20 rounded animate-skeleton" />
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

export function PharmacistHome() {
  const { data: dispensations, isLoading: loadingDisp } = useQuery({
    queryKey: ['dispensations'],
    queryFn: async () => {
      const res = await api.get('/dispensations', { params: { take: 5 } });
      return res.data;
    },
  });

  const { data: expiring, isLoading: loadingExp } = useQuery({
    queryKey: ['batches', 'expiring'],
    queryFn: async () => {
      const res = await api.get('/drugs/_/batches/expiring', { params: { days: 30 } });
      return res.data;
    },
  });

  const { data: pendingRx, isLoading: loadingRx } = useQuery({
    queryKey: ['prescriptions', 'pending'],
    queryFn: async () => {
      const res = await api.get('/prescriptions', { params: { status: 'PENDING', take: 10 } });
      return res.data;
    },
  });

  const initialLoading = loadingDisp && loadingExp && loadingRx;

  if (initialLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pharmacy Dashboard</h2>
          <p className="text-sm text-muted-foreground">Dispensation and inventory overview</p>
        </div>
        <Link to="/pharmacist/scan">
          <Button className="shadow-sm">
            <ScanLine className="mr-2 h-4 w-4" />
            Verify Prescription
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Rx"
          value={pendingRx?.items?.length ?? 0}
          subtitle="Awaiting dispensation"
          icon={<ClipboardList className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Dispensed Today"
          value={dispensations?.items?.length ?? 0}
          icon={<Pill className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Expiring Batches"
          value={expiring?.items?.length ?? 0}
          subtitle="Within 30 days"
          icon={<AlertTriangle className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title="Inventory"
          value="Active"
          subtitle="FIFO tracking enabled"
          icon={<Package className="h-5 w-5" />}
          color="cyan"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending prescriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Pending Prescriptions</CardTitle>
            <Link to="/pharmacist/scan">
              <Button variant="ghost" size="sm" className="text-xs">
                Scan QR <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!pendingRx?.items?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No pending prescriptions</p>
                <p className="text-xs text-muted-foreground/70">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRx.items.map((rx: Record<string, unknown>) => (
                  <div key={rx.id as string} className="flex items-center justify-between rounded-xl border border-border/50 p-3.5 transition-all duration-200 hover:bg-accent/30 hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Pill className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {(rx.drug as { name: string })?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(rx.patient as { fullName: string })?.fullName} &middot; Qty: {rx.quantity as number}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-0 text-[11px]">PENDING</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring batches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Expiring Soon</CardTitle>
            <Link to="/pharmacist/inventory">
              <Button variant="ghost" size="sm" className="text-xs">
                Inventory <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!expiring?.items?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Package className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No batches expiring soon</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiring.items.slice(0, 5).map((b: Record<string, unknown>) => (
                  <div key={b.id as string} className="flex items-center justify-between rounded-xl border border-border/50 p-3.5 transition-all duration-200 hover:bg-accent/30 hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {(b.drug as { name: string })?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Lot {b.lotNumber as string} &middot; Qty: {b.quantityOnHand as number}
                        </p>
                      </div>
                    </div>
                    <Badge variant="warning" className="text-[11px]">
                      {new Date(b.expiresAt as string).toLocaleDateString()}
                    </Badge>
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
