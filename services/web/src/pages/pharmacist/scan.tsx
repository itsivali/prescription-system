import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Hash,
  CheckCircle2,
  AlertCircle,
  Pill,
  User,
  Banknote,
  Loader2,
  Download,
} from 'lucide-react';

type DispenseResult = {
  id: string;
  dispensedAt: string;
  invoiceId: string;
  prescription: {
    dosage: string;
    quantity: number;
    drug: { name: string; strength: string };
    patient: { fullName: string; mrn: string };
  };
  invoice?: {
    id: string;
    totalCents: number;
    copayCents: number;
    insuredCents: number;
  };
};

function formatKES(cents: number): string {
  return `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

export function ScanPage() {
  const [hashInput, setHashInput] = useState('');
  const [result, setResult] = useState<DispenseResult | null>(null);
  const [error, setError] = useState('');

  const dispense = useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post('/dispensations', { code });
      return res.data as DispenseResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError('');
      setHashInput('');
      toast.success('Medication dispensed successfully');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Dispensation failed. Check the prescription code and try again.';
      setError(msg);
      setResult(null);
    },
  });

  const downloadPdf = async (invoiceId: string) => {
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
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dispense Medication</h2>
        <p className="text-sm text-muted-foreground">
          Enter the patient pickup code (or full prescription hash) from the invoice to validate and dispense
        </p>
      </div>

      {/* Hash input */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-700 px-6 py-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Hash className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">Prescription Verification</h3>
          <p className="mt-1 text-sm text-teal-100">
            Enter the code shown on the patient's invoice
          </p>
        </div>
        <CardContent className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (hashInput.trim()) dispense.mutate(hashInput.trim());
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="prescriptionHash" className="text-sm font-medium">
                Prescription Code
              </Label>
              <Input
                id="prescriptionHash"
                placeholder="e.g. A1B2-C3D4-E5F6 (or 64-char hash)"
                value={hashInput}
                onChange={(e) => {
                  setHashInput(e.target.value);
                  setError('');
                }}
                className="h-11 font-mono text-sm uppercase"
                maxLength={128}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Pharmacists can accept either the short pickup code or the full secure hash
              </p>
            </div>
            <Button
              type="submit"
              className="h-11 w-full shadow-sm"
              disabled={!hashInput.trim() || dispense.isPending}
            >
              {dispense.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Pill className="mr-2 h-4 w-4" />
                  Validate & Dispense
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 animate-slide-up">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Validation Failed</p>
              <p className="mt-1 text-sm text-destructive/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success result */}
      {result && (
        <Card className="border-success/30 animate-slide-up overflow-hidden">
          <div className="bg-success/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <div>
                <p className="font-semibold text-success">Dispensation Complete</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(result.dispensedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <CardContent className="space-y-5 p-6">
            {/* Patient info */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{result.prescription.patient.fullName}</p>
                <p className="text-xs text-muted-foreground">MRN: {result.prescription.patient.mrn}</p>
              </div>
            </div>

            <Separator />

            {/* Medication */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Pill className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-semibold">
                  {result.prescription.drug.name} {result.prescription.drug.strength}
                </p>
                <div className="flex gap-4">
                  <span className="text-xs text-muted-foreground">
                    Qty: <span className="font-medium text-foreground">{result.prescription.quantity}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Dosage: <span className="font-medium text-foreground">{result.prescription.dosage}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Invoice */}
            {result.invoice && (
              <>
                <Separator />
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-2 text-sm font-semibold">Invoice</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-sm font-bold">{formatKES(result.invoice.totalCents)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Copay</p>
                        <p className="text-sm font-bold">{formatKES(result.invoice.copayCents)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Insurance</p>
                        <p className="text-sm font-bold">{formatKES(result.invoice.insuredCents)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Invoice PDF */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 rounded-lg"
                  onClick={() => downloadPdf(result.invoice!.id)}
                >
                  <Download className="h-4 w-4" />
                  Download Invoice (PDF)
                </Button>
              </>
            )}

            <div className="flex justify-end">
              <Badge variant="success" className="text-xs">
                Successfully Dispensed
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
