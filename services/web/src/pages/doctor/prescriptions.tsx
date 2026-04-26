import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  X,
  User,
  Pill,
  Stethoscope,
  Banknote,
  Clock,
  Copy,
  CheckCircle2,
  FileText,
} from 'lucide-react';

function formatKES(cents: number): string {
  return `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

type Prescription = {
  id: string;
  status: string;
  dosage: string;
  quantity: number;
  qrHash: string;
  signedAt: string;
  expiresAt: string;
  drug: { name: string; strength: string; form: string; unitPriceCents: number };
  patient: {
    fullName: string;
    mrn: string;
    insurance?: { carrier: string; coveragePercent: number } | null;
  };
  doctor: {
    user: { fullName: string };
    specialty: { name: string };
  };
};

type PrescriptionInvoice = {
  prescriptionId: string;
  prescriptionHash: string;
  patientPickupCode: string;
  expiresAt: string;
  patient: { fullName: string; mrn: string; dateOfBirth: string };
  doctor: { fullName: string; specialty: string };
  drug: { name: string; strength: string; form: string; unitPriceCents: number };
  quantity: number;
  dosage: string;
  totalCents: number;
  copayCents: number;
  insuredCents: number;
  insuranceCarrier: string | null;
};

const columns: Column<Prescription>[] = [
  {
    key: 'patient',
    header: 'Patient',
    render: (r) => (
      <div>
        <p className="text-sm font-medium">{r.patient.fullName}</p>
        <p className="text-[11px] text-muted-foreground">{r.patient.mrn}</p>
      </div>
    ),
  },
  {
    key: 'drug',
    header: 'Medication',
    render: (r) => `${r.drug.name} ${r.drug.strength}`,
  },
  { key: 'dosage', header: 'Dosage' },
  { key: 'quantity', header: 'Qty', className: 'w-16' },
  {
    key: 'signedAt',
    header: 'Date',
    render: (r) => new Date(r.signedAt).toLocaleDateString(),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <StatusBadge status={r.status} />,
  },
];

export function PrescriptionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [invoice, setInvoice] = useState<PrescriptionInvoice | null>(null);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => {
      const res = await api.get('/prescriptions', { params: { take: 100 } });
      return res.data as { items: Prescription[] };
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Prescriptions</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Prescription'}
        </Button>
      </div>

      {showForm && (
        <NewPrescriptionForm
          onDone={(result) => {
            setShowForm(false);
            setInvoice(result);
            queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
          }}
        />
      )}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        onRowClick={(rx) => setSelectedRx(rx)}
        emptyMessage="No prescriptions found."
      />

      {/* Invoice dialog — shown after creating a prescription */}
      <Dialog open={!!invoice} onOpenChange={() => setInvoice(null)}>
        {invoice && <PrescriptionInvoiceView invoice={invoice} />}
      </Dialog>

      {/* Detail dialog — shown when clicking a row */}
      <Dialog open={!!selectedRx} onOpenChange={() => setSelectedRx(null)}>
        {selectedRx && <PrescriptionDetailView rx={selectedRx} />}
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prescription Invoice — displayed after the doctor creates a prescription
// ---------------------------------------------------------------------------
function PrescriptionInvoiceView({ invoice }: { invoice: PrescriptionInvoice }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const copyPickupCode = () => {
    navigator.clipboard.writeText(invoice.patientPickupCode);
    setCopiedCode(true);
    toast.success('Pickup code copied');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyHash = () => {
    navigator.clipboard.writeText(invoice.prescriptionHash);
    setCopiedHash(true);
    toast.success('Secure hash copied');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          Prescription Invoice
        </DialogTitle>
        <DialogDescription>Give this pickup code to the pharmacist to collect medication</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Patient-facing pickup code */}
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Patient Pickup Code
          </p>
          <p className="font-mono text-2xl font-bold tracking-[0.18em] text-primary">
            {invoice.patientPickupCode}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 text-xs"
            onClick={copyPickupCode}
          >
            {copiedCode ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedCode ? 'Copied' : 'Copy Pickup Code'}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Easy to remember, cryptographically tied to the secure prescription hash.
          </p>
        </div>

        {/* Full secure hash */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Secure Prescription Hash
            </p>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={copyHash}>
              {copiedHash ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedHash ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="mt-1 break-all font-mono text-[11px] font-medium text-foreground/80">
            {invoice.prescriptionHash}
          </p>
        </div>

        {/* Patient */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</p>
            <p className="text-sm font-medium">{invoice.patient.fullName}</p>
            <p className="text-xs text-muted-foreground">MRN: {invoice.patient.mrn}</p>
          </div>
        </div>

        <Separator />

        {/* Doctor */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prescribing Doctor</p>
            <p className="text-sm font-medium">Dr. {invoice.doctor.fullName}</p>
            <p className="text-xs text-muted-foreground">{invoice.doctor.specialty}</p>
          </div>
        </div>

        <Separator />

        {/* Medication */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Pill className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medication</p>
            <p className="text-sm font-medium">{invoice.drug.name} {invoice.drug.strength}</p>
            <p className="text-xs text-muted-foreground">{invoice.drug.form}</p>
            <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span>Qty: <span className="font-medium text-foreground">{invoice.quantity}</span></span>
              <span>Dosage: <span className="font-medium text-foreground">{invoice.dosage}</span></span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Billing table */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Banknote className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing (KES)</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Item</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/60">
                    <td className="px-3 py-2">Medication total</td>
                    <td className="px-3 py-2 text-right font-medium">{formatKES(invoice.totalCents)}</td>
                  </tr>
                  <tr className="border-t border-border/60">
                    <td className="px-3 py-2">Insurance covered</td>
                    <td className="px-3 py-2 text-right font-medium">{formatKES(invoice.insuredCents)}</td>
                  </tr>
                  <tr className="border-t border-border/60 bg-primary/5">
                    <td className="px-3 py-2 font-semibold">Patient copay</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatKES(invoice.copayCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {invoice.insuranceCarrier && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Carrier: <span className="font-medium">{invoice.insuranceCarrier}</span>
              </p>
            )}
          </div>
        </div>

        {/* Expiry */}
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-xs text-amber-700">
            Valid until {new Date(invoice.expiresAt).toLocaleString()}
          </p>
        </div>
      </div>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Prescription Detail — shown when clicking a row in the table
// ---------------------------------------------------------------------------
function PrescriptionDetailView({ rx }: { rx: Prescription }) {
  const totalCents   = rx.quantity * rx.drug.unitPriceCents;
  const coverage     = rx.patient.insurance?.coveragePercent ?? 0;
  const insuredCents = Math.floor(totalCents * coverage / 100);
  const copayCents   = totalCents - insuredCents;

  const copyHash = () => {
    navigator.clipboard.writeText(rx.qrHash);
    toast.success('Prescription hash copied');
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          Prescription Details
        </DialogTitle>
        <DialogDescription>
          {rx.patient.fullName} — {rx.drug.name} {rx.drug.strength}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Hash */}
        {rx.status === 'PENDING' && (
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-center">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prescription Code</p>
            <p className="break-all font-mono text-xs font-bold text-primary">{rx.qrHash}</p>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-xs" onClick={copyHash}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        )}

        {/* Info rows */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Patient</p>
            <p className="font-medium">{rx.patient.fullName}</p>
            <p className="text-xs text-muted-foreground">{rx.patient.mrn}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Doctor</p>
            <p className="font-medium">Dr. {rx.doctor.user.fullName}</p>
            <p className="text-xs text-muted-foreground">{rx.doctor.specialty.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Medication</p>
            <p className="font-medium">{rx.drug.name} {rx.drug.strength}</p>
            <p className="text-xs text-muted-foreground">{rx.dosage}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Quantity</p>
            <p className="font-medium">{rx.quantity}</p>
          </div>
        </div>

        <Separator />

        {/* Billing */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-bold">{formatKES(totalCents)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">Copay</p>
            <p className="text-sm font-bold">{formatKES(copayCents)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">Insurance</p>
            <p className="text-sm font-bold">{formatKES(insuredCents)}</p>
          </div>
        </div>
        {rx.patient.insurance && (
          <p className="text-xs text-muted-foreground">
            Carrier: <span className="font-medium">{rx.patient.insurance.carrier}</span> ({rx.patient.insurance.coveragePercent}% coverage)
          </p>
        )}

        {/* Status + dates */}
        <div className="flex items-center justify-between">
          <StatusBadge status={rx.status} />
          <span className="text-xs text-muted-foreground">
            Expires: {new Date(rx.expiresAt).toLocaleString()}
          </span>
        </div>
      </div>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// New Prescription Form
// ---------------------------------------------------------------------------
function NewPrescriptionForm({ onDone }: { onDone: (result: PrescriptionInvoice) => void }) {
  const [form, setForm] = useState({
    encounterId: '',
    patientId: '',
    drugId: '',
    quantity: '',
    dosage: '',
  });
  const [error, setError] = useState('');

  const { data: encounters } = useQuery({
    queryKey: ['encounters', 'active-for-rx'],
    queryFn: async () => {
      const res = await api.get('/encounters', { params: { active: true, take: 50 } });
      return res.data;
    },
  });

  const { data: drugs } = useQuery({
    queryKey: ['drugs'],
    queryFn: async () => {
      const res = await api.get('/drugs', { params: { take: 200 } });
      return res.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post('/prescriptions', {
        encounterId: form.encounterId,
        patientId: form.patientId,
        drugId: form.drugId,
        quantity: Number(form.quantity),
        dosage: form.dosage,
      });
      return res.data as PrescriptionInvoice;
    },
    onSuccess: (data) => {
      toast.success('Prescription created');
      onDone(data);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create prescription';
      setError(msg);
    },
  });

  function handleEncounterSelect(encId: string) {
    const enc = encounters?.items?.find((e: { id: string }) => e.id === encId);
    setForm((f) => ({
      ...f,
      encounterId: encId,
      patientId: enc?.patientId ?? '',
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New Prescription</CardTitle>
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

          <div className="space-y-2">
            <Label>Encounter</Label>
            <select
              className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={form.encounterId}
              onChange={(e) => handleEncounterSelect(e.target.value)}
              required
            >
              <option value="">Select encounter...</option>
              {encounters?.items?.map((enc: Record<string, unknown>) => (
                <option key={enc.id as string} value={enc.id as string}>
                  {(enc.patient as { fullName: string })?.fullName} —{' '}
                  {new Date(enc.startedAt as string).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Medication</Label>
            <select
              className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={form.drugId}
              onChange={(e) => setForm((f) => ({ ...f, drugId: e.target.value }))}
              required
            >
              <option value="">Select drug...</option>
              {drugs?.items?.map((d: { id: string; name: string; strength: string }) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.strength})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Dosage Instructions</Label>
            <Input
              placeholder="e.g. Take 1 tablet twice daily"
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
              required
            />
          </div>

          <div className="col-span-full flex justify-end gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating...' : 'Create Prescription'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'FULFILLED'
      ? 'success'
      : status === 'VOID'
        ? 'destructive'
        : status === 'EXPIRED'
          ? 'warning'
          : 'default';
  return <Badge variant={variant as 'default'}>{status}</Badge>;
}
