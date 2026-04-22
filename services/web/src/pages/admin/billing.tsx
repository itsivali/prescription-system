import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { SelectNative } from '@/components/ui/select-native';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Banknote,
  CreditCard,
  FileText,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  CheckCircle2,
  XCircle,
  Smartphone,
  Download,
} from 'lucide-react';

type Invoice = {
  id: string;
  totalCents: number;
  copayCents: number;
  insuredCents: number;
  status: string;
  createdAt: string;
  patient: { fullName: string; mrn: string };
};

function formatKES(c: number) {
  return `KES ${(c / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ReactNode }> = {
    OPEN: {
      className: 'bg-amber-50 text-amber-700 border-amber-200/60',
      icon: <Receipt className="h-3 w-3" />,
    },
    PAID: {
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    WRITTEN_OFF: {
      className: 'bg-stone-100 text-stone-500 border-stone-200/60',
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const c = config[status] ?? config.OPEN;
  return (
    <Badge variant="outline" className={`${c.className} gap-1 text-[11px] font-medium`}>
      {c.icon}
      {status.replace('_', ' ')}
    </Badge>
  );
}

function PaymentMethodIcon({ method }: { method?: string }) {
  switch (method) {
    case 'MPESA':
      return <Smartphone className="h-3 w-3 text-green-600" />;
    case 'CARD':
      return <CreditCard className="h-3 w-3 text-blue-600" />;
    case 'CASH':
      return <Banknote className="h-3 w-3 text-amber-600" />;
    default:
      return null;
  }
}

const columns: Column<Invoice>[] = [
  {
    key: 'patient',
    header: 'Patient',
    render: (r) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-[11px] font-bold text-primary">
          {r.patient.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium">{r.patient.fullName}</p>
          <p className="text-[11px] text-muted-foreground">{r.patient.mrn}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    render: (r) => <span className="font-semibold text-foreground">{formatKES(r.totalCents)}</span>,
  },
  {
    key: 'copay',
    header: 'Copay',
    render: (r) => <span className="text-muted-foreground">{formatKES(r.copayCents)}</span>,
  },
  {
    key: 'insured',
    header: 'Insured',
    render: (r) => <span className="text-muted-foreground">{formatKES(r.insuredCents)}</span>,
  },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  {
    key: 'createdAt',
    header: 'Date',
    render: (r) => (
      <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
    ),
  },
];

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="h-6 w-24 rounded animate-skeleton" />
        <div className="h-3.5 w-48 rounded animate-skeleton" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-20 rounded animate-skeleton" />
                <div className="h-6 w-16 rounded animate-skeleton" />
              </div>
              <div className="h-10 w-10 rounded-xl animate-skeleton" />
            </div>
          </CardContent></Card>
        ))}
      </div>
      <div className="h-10 w-64 rounded-xl animate-skeleton" />
      <div className="rounded-xl border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 border-b p-4 last:border-0">
            <div className="h-8 w-8 rounded-lg animate-skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded animate-skeleton" />
              <div className="h-2.5 w-20 rounded animate-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BillingPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const res = await api.get('/billing/invoices', {
        params: { status: statusFilter || undefined, take: 100 },
      });
      return res.data as { items: Invoice[]; total: number };
    },
  });

  if (isLoading && !data) return <BillingSkeleton />;

  const items = data?.items ?? [];
  const totalRevenue = items.reduce((s, i) => s + i.totalCents, 0);
  const openCount = items.filter(i => i.status === 'OPEN').length;
  const paidCount = items.filter(i => i.status === 'PAID').length;
  const paidRevenue = items.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-sm text-muted-foreground">Invoice management and payment tracking (KES)</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatKES(totalRevenue)}
          icon={<Banknote className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Collected"
          value={formatKES(paidRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Open Invoices"
          value={openCount}
          subtitle="Awaiting payment"
          icon={<FileText className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Paid"
          value={paidCount}
          subtitle={`of ${items.length} total`}
          icon={<CreditCard className="h-5 w-5" />}
          color="teal"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {[
          { value: '', label: 'All' },
          { value: 'OPEN', label: 'Open' },
          { value: 'PAID', label: 'Paid' },
          { value: 'WRITTEN_OFF', label: 'Written Off' },
        ].map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
            className="rounded-lg text-xs"
          >
            {f.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        onRowClick={(inv) => setSelectedInvoice(inv.id)}
        emptyMessage="No invoices found."
        emptyIcon={<FileText className="mb-1 h-8 w-8 text-muted-foreground/30" />}
      />

      {data && (
        <p className="text-xs text-muted-foreground">
          Showing {items.length} of {data.total} invoices
        </p>
      )}

      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        {selectedInvoice && (
          <InvoiceDetailDialog
            invoiceId={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function InvoiceDetailDialog({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState('PATIENT');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const { data: invoice } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const res = await api.get(`/billing/invoices/${invoiceId}`);
      return res.data;
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ['invoice', invoiceId, 'ledger'],
    queryFn: async () => {
      const res = await api.get(`/billing/invoices/${invoiceId}/ledger`);
      return res.data;
    },
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      await api.post(`/billing/invoices/${invoiceId}/payments`, {
        amountCents: Math.round(Number(paymentAmount) * 100),
        source: paymentSource,
        paymentMethod,
      });
    },
    onSuccess: () => {
      setPaymentAmount('');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded');
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const writeOff = useMutation({
    mutationFn: async () => {
      await api.post(`/billing/invoices/${invoiceId}/write-off`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice written off');
      onClose();
    },
    onError: () => toast.error('Failed to write off invoice'),
  });

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/billing/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Invoice PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Receipt className="h-4 w-4" />
          </div>
          Invoice Details
        </DialogTitle>
        <DialogDescription>
          {invoice?.patient?.fullName ?? 'Loading...'}
        </DialogDescription>
      </DialogHeader>

      {invoice && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="Total"
              value={formatKES(invoice.totalCents)}
              icon={<Banknote className="h-3.5 w-3.5" />}
              color="bg-emerald-50 text-emerald-600"
            />
            <SummaryCard
              label="Copay"
              value={formatKES(invoice.copayCents)}
              icon={<ArrowDownRight className="h-3.5 w-3.5" />}
              color="bg-amber-50 text-amber-600"
            />
            <SummaryCard
              label="Insured"
              value={formatKES(invoice.insuredCents)}
              icon={<ArrowUpRight className="h-3.5 w-3.5" />}
              color="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              label="Status"
              value={invoice.status.replace('_', ' ')}
              icon={invoice.status === 'PAID' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
              color={invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-600'}
            />
          </div>

          {/* Download PDF */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 rounded-lg"
            onClick={downloadPdf}
          >
            <Download className="h-4 w-4" />
            Download Invoice (PDF)
          </Button>

          {/* Ledger */}
          {ledger?.items?.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transactions
              </h4>
              <div className="space-y-1.5">
                {ledger.items.map((tx: Record<string, unknown>) => (
                  <div
                    key={tx.id as string}
                    className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3.5 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
                        tx.direction === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {tx.direction === 'CREDIT' ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{tx.memo as string}</span>
                        {tx.paymentMethod ? <PaymentMethodIcon method={String(tx.paymentMethod)} /> : null}
                      </div>
                    </div>
                    <span className="text-xs font-semibold">{formatKES(tx.amountCents as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {invoice.status === 'OPEN' && (
            <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Record Payment
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Amount (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Source</Label>
                  <SelectNative
                    value={paymentSource}
                    onChange={(e) => setPaymentSource(e.target.value)}
                    className="h-9"
                  >
                    <option value="PATIENT">Patient</option>
                    <option value="INSURANCE">Insurance</option>
                  </SelectNative>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Payment Method</Label>
                  <SelectNative
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-9"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MPESA">M-Pesa</option>
                  </SelectNative>
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    className="h-9 w-full rounded-lg"
                    onClick={() => recordPayment.mutate()}
                    disabled={!paymentAmount || recordPayment.isPending}
                  >
                    Pay
                  </Button>
                </div>
              </div>

              {/* Insurance providers info */}
              {paymentSource === 'INSURANCE' && (
                <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3">
                  <p className="text-[11px] font-medium text-blue-700 mb-1">Supported Insurance Providers</p>
                  <div className="flex flex-wrap gap-1">
                    {['NHIF/SHA', 'AAR', 'Jubilee', 'Madison', 'UAP', 'CIC', 'Britam', 'GA Insurance', 'Resolution', 'MUA'].map((ins) => (
                      <span key={ins} className="inline-flex rounded-md bg-blue-100/60 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                        {ins}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-lg text-xs"
                onClick={() => writeOff.mutate()}
                disabled={writeOff.isPending}
              >
                Write Off Invoice
              </Button>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
