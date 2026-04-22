import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';

type Dispensation = {
  id: string;
  dispensedAt: string;
  prescription: {
    quantity: number;
    dosage: string;
    drug: { name: string; strength: string };
    patient: { fullName: string; mrn: string };
  };
};

const columns: Column<Dispensation>[] = [
  {
    key: 'patient',
    header: 'Patient',
    render: (r) => r.prescription.patient.fullName,
  },
  {
    key: 'mrn',
    header: 'MRN',
    render: (r) => r.prescription.patient.mrn,
  },
  {
    key: 'drug',
    header: 'Medication',
    render: (r) => `${r.prescription.drug.name} ${r.prescription.drug.strength}`,
  },
  {
    key: 'qty',
    header: 'Qty',
    render: (r) => r.prescription.quantity,
    className: 'w-16',
  },
  {
    key: 'dispensedAt',
    header: 'Dispensed At',
    render: (r) => new Date(r.dispensedAt).toLocaleString(),
  },
  {
    key: 'status',
    header: 'Status',
    render: () => <Badge variant="success">Dispensed</Badge>,
  },
];

export function DispensationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dispensations'],
    queryFn: async () => {
      const res = await api.get('/dispensations', { params: { take: 100 } });
      return res.data as { items: Dispensation[] };
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Dispensations</h2>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No dispensations yet."
      />
    </div>
  );
}
