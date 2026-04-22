import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Search, FileText, ShieldCheck } from 'lucide-react';

type AuditEvent = {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-blue-50 text-blue-600 border-blue-200/60',
  DOCTOR: 'bg-teal-50 text-teal-600 border-teal-200/60',
  PHARMACIST: 'bg-amber-50 text-amber-600 border-amber-200/60',
};

const columns: Column<AuditEvent>[] = [
  {
    key: 'action',
    header: 'Action',
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <span className="font-medium">{r.action}</span>
      </div>
    ),
  },
  { key: 'entity', header: 'Entity' },
  {
    key: 'entityId',
    header: 'Entity ID',
    className: 'max-w-[120px]',
    render: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.entityId.slice(0, 8)}...</span>
    ),
  },
  {
    key: 'actorRole',
    header: 'Actor',
    render: (r) => (
      <Badge variant="outline" className={`text-[11px] font-medium ${ROLE_COLORS[r.actorRole] ?? ''}`}>
        {r.actorRole}
      </Badge>
    ),
  },
  {
    key: 'occurredAt',
    header: 'When',
    render: (r) => (
      <span className="text-muted-foreground">{new Date(r.occurredAt).toLocaleString()}</span>
    ),
  },
];

export function AuditPage() {
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: async () => {
      const res = await api.get('/audit', {
        params: { action: action || undefined, take: 200 },
      });
      return res.data as { items: AuditEvent[] };
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-sm text-muted-foreground">System activity and access history</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by action..."
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(r) => String(r.id)}
        isLoading={isLoading}
        emptyMessage="No audit events found."
        emptyIcon={<FileText className="mb-1 h-8 w-8 text-muted-foreground/30" />}
      />
    </div>
  );
}
