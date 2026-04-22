import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Search, Users } from 'lucide-react';

type Patient = {
  id: string;
  mrn: string;
  fullName: string;
  dateOfBirth: string;
  insurance?: { carrier: string } | null;
};

const columns: Column<Patient>[] = [
  {
    key: 'name',
    header: 'Patient',
    render: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {r.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <span className="font-medium">{r.fullName}</span>
      </div>
    ),
  },
  { key: 'mrn', header: 'MRN' },
  {
    key: 'dateOfBirth',
    header: 'Date of Birth',
    render: (r) => new Date(r.dateOfBirth).toLocaleDateString(),
  },
  {
    key: 'insurance',
    header: 'Insurance',
    render: (r) =>
      r.insurance?.carrier ? (
        <Badge variant="secondary" className="text-[11px]">{r.insurance.carrier}</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">None</span>
      ),
  },
];

export function PatientsPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const res = await api.get('/patients', { params: { q: search || undefined, take: 50 } });
      return res.data as { items: Patient[]; total: number };
    },
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Patients</h2>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} patients on record` : 'Search and manage patient records'}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or MRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No patients found."
        emptyIcon={<Users className="mb-1 h-8 w-8 text-muted-foreground/40" />}
        onRowClick={(patient) => navigate(`/doctor/patients/${patient.id}`)}
      />
    </div>
  );
}
