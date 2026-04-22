import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { Plus, X, Square } from 'lucide-react';

type Encounter = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  patient: { fullName: string; mrn: string };
};

const columns: Column<Encounter>[] = [
  {
    key: 'patient',
    header: 'Patient',
    render: (r) => r.patient.fullName,
  },
  {
    key: 'mrn',
    header: 'MRN',
    render: (r) => r.patient.mrn,
  },
  {
    key: 'startedAt',
    header: 'Started',
    render: (r) => new Date(r.startedAt).toLocaleString(),
  },
  {
    key: 'endedAt',
    header: 'Ended',
    render: (r) => (r.endedAt ? new Date(r.endedAt).toLocaleString() : '—'),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={r.endedAt ? 'secondary' : 'default'}>
        {r.endedAt ? 'Completed' : 'Active'}
      </Badge>
    ),
  },
];

export function EncountersPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['encounters'],
    queryFn: async () => {
      const res = await api.get('/encounters', { params: { take: 100 } });
      return res.data as { items: Encounter[]; total: number };
    },
  });

  const endEncounter = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/encounters/${id}/end`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
      toast.success('Encounter ended');
    },
    onError: () => toast.error('Failed to end encounter'),
  });

  const columnsWithActions: Column<Encounter>[] = [
    ...columns,
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (r) =>
        !r.endedAt ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => endEncounter.mutate(r.id)}
            disabled={endEncounter.isPending}
          >
            <Square className="mr-1 h-3 w-3" />
            End
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Encounters</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showForm ? 'Cancel' : 'Start Encounter'}
        </Button>
      </div>

      {showForm && (
        <NewEncounterForm
          onDone={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['encounters'] });
          }}
        />
      )}

      <DataTable
        columns={columnsWithActions}
        data={data?.items ?? []}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No encounters found."
      />
    </div>
  );
}

function NewEncounterForm({ onDone }: { onDone: () => void }) {
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [error, setError] = useState('');

  const { data: patients } = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: async () => {
      const res = await api.get('/patients', {
        params: { q: patientSearch || undefined, take: 20 },
      });
      return res.data;
    },
    enabled: patientSearch.length >= 2,
  });

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/encounters', { patientId, notes: notes || undefined });
    },
    onSuccess: () => onDone(),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to start encounter. Are you on shift?';
      setError(msg);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Start New Encounter</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          {error && (
            <div className="col-span-full rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="col-span-full space-y-2">
            <Label>Search Patient</Label>
            <Input
              placeholder="Type patient name or MRN..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
            {patients?.items?.length > 0 && !patientId && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {patients.items.map((p: { id: string; fullName: string; mrn: string }) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setPatientId(p.id);
                      setPatientSearch(p.fullName);
                    }}
                  >
                    <span>{p.fullName}</span>
                    <span className="text-muted-foreground">{p.mrn}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-full space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="Initial notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="col-span-full flex justify-end gap-2">
            <Button type="submit" disabled={!patientId || create.isPending}>
              {create.isPending ? 'Starting...' : 'Start Encounter'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
