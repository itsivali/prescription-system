import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Search, Plus, X, Package } from 'lucide-react';

type Drug = {
  id: string;
  name: string;
  ndcCode: string;
  form: string;
  strength: string;
  stockOnHand?: number;
  drugClass?: { name: string };
};

const columns: Column<Drug>[] = [
  { key: 'name', header: 'Drug Name' },
  { key: 'ndcCode', header: 'NDC Code' },
  { key: 'form', header: 'Form' },
  { key: 'strength', header: 'Strength' },
  {
    key: 'drugClass',
    header: 'Class',
    render: (r) => r.drugClass?.name ?? '—',
  },
  {
    key: 'stock',
    header: 'Stock',
    render: (r) => {
      const stock = r.stockOnHand ?? 0;
      return (
        <Badge variant={stock > 0 ? 'success' : 'destructive'}>
          {stock}
        </Badge>
      );
    },
  },
];

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['drugs', search],
    queryFn: async () => {
      const res = await api.get('/drugs', { params: { q: search || undefined, take: 100 } });
      return res.data as { items: Drug[] };
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search drugs by name or NDC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div
        onClick={(e) => {
          const row = (e.target as HTMLElement).closest('tr');
          if (!row || row.closest('thead')) return;
          const idx = Array.from(row.parentElement!.children).indexOf(row);
          const drug = data?.items[idx];
          if (drug) {
            setExpandedDrug(expandedDrug === drug.id ? null : drug.id);
            setShowReceive(null);
          }
        }}
        className="cursor-pointer"
      >
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="No drugs found."
        />
      </div>

      {expandedDrug && (
        <DrugDetail
          drugId={expandedDrug}
          showReceive={showReceive === expandedDrug}
          onToggleReceive={() =>
            setShowReceive(showReceive === expandedDrug ? null : expandedDrug)
          }
          onClose={() => {
            setExpandedDrug(null);
            setShowReceive(null);
          }}
        />
      )}
    </div>
  );
}

function DrugDetail({
  drugId,
  showReceive,
  onToggleReceive,
  onClose,
}: {
  drugId: string;
  showReceive: boolean;
  onToggleReceive: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: drug } = useQuery({
    queryKey: ['drug', drugId],
    queryFn: async () => {
      const res = await api.get(`/drugs/${drugId}`);
      return res.data;
    },
  });

  const { data: batches } = useQuery({
    queryKey: ['drug', drugId, 'batches'],
    queryFn: async () => {
      const res = await api.get(`/drugs/${drugId}/batches`);
      return res.data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">{drug?.name ?? 'Loading...'}</CardTitle>
            {drug && (
              <p className="text-sm text-muted-foreground">
                {drug.form} &middot; {drug.strength} &middot; Stock: {drug.stockOnHand ?? 0}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onToggleReceive}>
            {showReceive ? <X className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
            {showReceive ? 'Cancel' : 'Receive Stock'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showReceive && (
          <ReceiveBatchForm
            drugId={drugId}
            onDone={() => {
              onToggleReceive();
              queryClient.invalidateQueries({ queryKey: ['drug', drugId] });
              queryClient.invalidateQueries({ queryKey: ['drugs'] });
            }}
          />
        )}

        <div>
          <h4 className="mb-2 text-sm font-medium">Batches</h4>
          {!batches?.items?.length ? (
            <p className="text-sm text-muted-foreground">No batches on record.</p>
          ) : (
            <div className="space-y-2">
              {batches.items.map((b: Record<string, unknown>) => {
                const isExpired = new Date(b.expiresAt as string) < new Date();
                return (
                  <div key={b.id as string} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <span className="font-medium">Lot {b.lotNumber as string}</span>
                      <span className="ml-2 text-muted-foreground">{b.supplier as string}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>Qty: {b.quantityOnHand as number}/{b.initialQuantity as number}</span>
                      <Badge variant={isExpired ? 'destructive' : 'secondary'}>
                        {isExpired ? 'Expired' : `Exp ${new Date(b.expiresAt as string).toLocaleDateString()}`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiveBatchForm({ drugId, onDone }: { drugId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    lotNumber: '',
    supplier: '',
    expiresAt: '',
    quantity: '',
  });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      await api.post(`/drugs/${drugId}/batches`, {
        lotNumber: form.lotNumber,
        supplier: form.supplier,
        expiresAt: new Date(form.expiresAt).toISOString(),
        quantity: Number(form.quantity),
      });
    },
    onSuccess: () => onDone(),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to receive batch';
      setError(msg);
    },
  });

  return (
    <form
      className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      {error && (
        <div className="col-span-full rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Lot Number</Label>
        <Input
          value={form.lotNumber}
          onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Supplier</Label>
        <Input
          value={form.supplier}
          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Expiry Date</Label>
        <Input
          type="date"
          value={form.expiresAt}
          onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Quantity</Label>
        <Input
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          required
        />
      </div>
      <div className="col-span-full flex justify-end">
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? 'Receiving...' : 'Receive Batch'}
        </Button>
      </div>
    </form>
  );
}
