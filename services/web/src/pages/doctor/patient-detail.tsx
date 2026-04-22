import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const res = await api.get(`/patients/${id}`);
      return res.data;
    },
  });

  const { data: encounters } = useQuery({
    queryKey: ['patient', id, 'encounters'],
    queryFn: async () => {
      const res = await api.get(`/patients/${id}/encounters`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['patient', id, 'prescriptions'],
    queryFn: async () => {
      const res = await api.get(`/patients/${id}/prescriptions`);
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading patient...</p>;
  }

  if (!patient) {
    return <p className="text-muted-foreground">Patient not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{patient.fullName}</h2>
          <p className="text-sm text-muted-foreground">
            MRN: {patient.mrn} &middot; DOB:{' '}
            {new Date(patient.dateOfBirth).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Patient info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Patient Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Full Name" value={patient.fullName} />
            <Row label="MRN" value={patient.mrn} />
            <Row label="Date of Birth" value={new Date(patient.dateOfBirth).toLocaleDateString()} />
            <Row label="Insurance" value={patient.insurance?.carrier ?? 'None'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Encounters</CardTitle>
          </CardHeader>
          <CardContent>
            {!encounters?.items?.length ? (
              <p className="text-sm text-muted-foreground">No encounters.</p>
            ) : (
              <div className="space-y-2">
                {encounters.items.slice(0, 5).map((enc: Record<string, unknown>) => (
                  <div key={enc.id as string} className="flex items-center justify-between text-sm">
                    <span>{new Date(enc.startedAt as string).toLocaleDateString()}</span>
                    <Badge variant={enc.endedAt ? 'secondary' : 'default'}>
                      {enc.endedAt ? 'Completed' : 'Active'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prescriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {!prescriptions?.items?.length ? (
            <p className="text-sm text-muted-foreground">No prescriptions.</p>
          ) : (
            <div className="space-y-3">
              {prescriptions.items.map((rx: Record<string, unknown>) => (
                <div key={rx.id as string} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {(rx.drug as { name: string })?.name ?? 'Unknown Drug'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rx.dosage as string} &middot; Qty: {rx.quantity as number}
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
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
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
  return <Badge variant={variant}>{status}</Badge>;
}
