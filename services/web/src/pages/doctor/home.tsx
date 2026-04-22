import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { toast } from 'sonner';
import {
  Users,
  ClipboardList,
  Activity,
  Clock,
  Stethoscope,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-32 rounded animate-skeleton" />
          <div className="h-3.5 w-52 rounded animate-skeleton" />
        </div>
        <div className="h-10 w-32 rounded-lg animate-skeleton" />
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
                <div key={j} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="h-9 w-9 rounded-full animate-skeleton" />
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

export function DoctorHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: encounters, isLoading: loadingEnc } = useQuery({
    queryKey: ['encounters', 'active'],
    queryFn: async () => {
      const res = await api.get('/encounters', { params: { active: true, take: 5 } });
      return res.data;
    },
  });

  const { data: prescriptions, isLoading: loadingRx } = useQuery({
    queryKey: ['prescriptions', 'recent'],
    queryFn: async () => {
      const res = await api.get('/prescriptions', { params: { take: 5 } });
      return res.data;
    },
  });

  const { data: patients, isLoading: loadingPat } = useQuery({
    queryKey: ['patients', 'count'],
    queryFn: async () => {
      const res = await api.get('/patients', { params: { take: 1 } });
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

  const initialLoading = loadingEnc && loadingRx && loadingPat && loadingDoc;

  const myProfile = doctors?.items?.find(
    (d: { userId: string }) => d.userId === user?.id,
  );
  const isOnShift = myProfile?.shiftEndsAt && new Date(myProfile.shiftEndsAt) > new Date();

  const clockIn = useMutation({
    mutationFn: () => api.post('/shifts/clock-in', { durationHours: 8 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success('You are now on shift');
    },
    onError: () => toast.error('Failed to clock in'),
  });

  const clockOut = useMutation({
    mutationFn: () => api.post('/shifts/clock-out'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success('Clocked out successfully');
    },
    onError: () => toast.error('Failed to clock out'),
  });

  if (initialLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {user?.doctorProfile
              ? `${user.doctorProfile.specialty.name} — ${user.doctorProfile.department.name}`
              : 'Clinical activity overview'}
          </p>
        </div>

        {isOnShift ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-sm font-medium text-success">On Shift</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => clockOut.mutate()} disabled={clockOut.isPending}>
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Clock Out
            </Button>
          </div>
        ) : (
          <Button onClick={() => clockIn.mutate()} disabled={clockIn.isPending} className="shadow-sm">
            <Stethoscope className="mr-2 h-4 w-4" />
            {clockIn.isPending ? 'Starting...' : 'Start Shift'}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Patients"
          value={patients?.total ?? 0}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Active Encounters"
          value={encounters?.items?.length ?? 0}
          icon={<Activity className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Prescriptions"
          value={prescriptions?.total ?? prescriptions?.items?.length ?? 0}
          icon={<ClipboardList className="h-5 w-5" />}
          color="violet"
        />
        <StatCard
          title="Shift Ends"
          value={
            isOnShift
              ? new Date(myProfile.shiftEndsAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Off Shift'
          }
          subtitle={isOnShift ? 'Currently active' : 'Clock in to start'}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active encounters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Active Encounters</CardTitle>
            <Link to="/doctor/encounters">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!encounters?.items?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Activity className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No active encounters</p>
                <p className="text-xs text-muted-foreground/70">Start a new encounter from the Encounters page</p>
              </div>
            ) : (
              <div className="space-y-2">
                {encounters.items.map((enc: Record<string, unknown>) => (
                  <div
                    key={enc.id as string}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {((enc.patient as { fullName: string })?.fullName ?? '')
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {(enc.patient as { fullName: string })?.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(enc.startedAt as string).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-success/10 text-success border-0 text-[11px]">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent prescriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Prescriptions</CardTitle>
            <Link to="/doctor/prescriptions">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!prescriptions?.items?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No prescriptions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {prescriptions.items.map((rx: Record<string, unknown>) => (
                  <div
                    key={rx.id as string}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(rx.drug as { name: string })?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(rx.patient as { fullName: string })?.fullName} &middot; Qty: {rx.quantity as number}
                      </p>
                    </div>
                    <StatusBadge status={rx.status as string} />
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'default'; className: string }> = {
    FULFILLED: { variant: 'success', className: 'bg-success/10 text-success border-0' },
    VOID: { variant: 'destructive', className: 'bg-destructive/10 text-destructive border-0' },
    EXPIRED: { variant: 'warning', className: 'bg-warning/10 text-warning border-0' },
    PENDING: { variant: 'default', className: 'bg-primary/10 text-primary border-0' },
  };
  const c = config[status] ?? config.PENDING;
  return (
    <Badge variant={c.variant} className={`${c.className} text-[11px]`}>
      {status}
    </Badge>
  );
}
