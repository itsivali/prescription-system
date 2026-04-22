import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, X, Building2, Stethoscope, Pill, Shield, FileHeart } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Configure hospital system parameters</p>
      </div>

      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="departments" className="text-xs">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="specialties" className="text-xs">
            <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
            Specialties
          </TabsTrigger>
          <TabsTrigger value="drug-classes" className="text-xs">
            <Pill className="mr-1.5 h-3.5 w-3.5" />
            Drug Classes
          </TabsTrigger>
          <TabsTrigger value="authorizations" className="text-xs">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Rx Auth
          </TabsTrigger>
          <TabsTrigger value="insurance" className="text-xs">
            <FileHeart className="mr-1.5 h-3.5 w-3.5" />
            Insurance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments"><DepartmentsSection /></TabsContent>
        <TabsContent value="specialties"><SpecialtiesSection /></TabsContent>
        <TabsContent value="drug-classes"><DrugClassesSection /></TabsContent>
        <TabsContent value="authorizations"><AuthorizationsSection /></TabsContent>
        <TabsContent value="insurance"><InsurancePoliciesSection /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Departments ─── */
function DepartmentsSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const { data } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/admin/departments');
      return res.data;
    },
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/departments', { name }),
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created');
    },
    onError: () => toast.error('Failed to create department'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Departments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="flex gap-2"
        >
          <Input
            placeholder="New department name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!name || create.isPending}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {data?.items?.map((d: { id: string; name: string }) => (
            <Badge key={d.id} variant="secondary" className="px-3 py-1.5 text-sm">
              <Building2 className="mr-1.5 h-3 w-3 text-muted-foreground" />
              {d.name}
            </Badge>
          ))}
          {!data?.items?.length && (
            <p className="text-sm text-muted-foreground">No departments configured</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Specialties ─── */
function SpecialtiesSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', departmentId: '' });

  const { data } = useQuery({
    queryKey: ['specialties'],
    queryFn: async () => {
      const res = await api.get('/admin/specialties');
      return res.data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/admin/departments');
      return res.data;
    },
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/specialties', form),
    onSuccess: () => {
      setForm({ code: '', name: '', departmentId: '' });
      queryClient.invalidateQueries({ queryKey: ['specialties'] });
      toast.success('Specialty created');
    },
    onError: () => toast.error('Failed to create specialty'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Stethoscope className="h-5 w-5 text-primary" />
          Specialties
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="grid gap-3 sm:grid-cols-4"
        >
          <Input
            placeholder="Code (CARDIO)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={form.departmentId}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
          >
            <option value="">Department...</option>
            {departments?.items?.map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <Button
            type="submit"
            size="sm"
            disabled={!form.code || !form.name || !form.departmentId || create.isPending}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </form>
        <div className="space-y-2">
          {data?.items?.map((s: { id: string; code: string; name: string; department?: { name: string } }) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs">{s.code}</Badge>
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              {s.department && (
                <span className="text-xs text-muted-foreground">{s.department.name}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Drug Classes ─── */
function DrugClassesSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '' });

  const { data } = useQuery({
    queryKey: ['drug-classes'],
    queryFn: async () => {
      const res = await api.get('/admin/drug-classes');
      return res.data;
    },
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/drug-classes', form),
    onSuccess: () => {
      setForm({ code: '', name: '' });
      queryClient.invalidateQueries({ queryKey: ['drug-classes'] });
      toast.success('Drug class created');
    },
    onError: () => toast.error('Failed to create drug class'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pill className="h-5 w-5 text-primary" />
          Drug Classes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="flex gap-2"
        >
          <Input
            placeholder="Code (OPIOID)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="w-40"
          />
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!form.code || !form.name || create.isPending}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {data?.items?.map((dc: { id: string; code: string; name: string }) => (
            <Badge key={dc.id} variant="secondary" className="px-3 py-1.5 text-sm">
              <Pill className="mr-1.5 h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-xs mr-1">{dc.code}</span>
              {dc.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Specialty-Drug Class Authorizations ─── */
function AuthorizationsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ specialtyId: '', drugClassId: '' });

  const { data } = useQuery({
    queryKey: ['specialty-drug-class'],
    queryFn: async () => {
      const res = await api.get('/admin/specialty-drug-class');
      return res.data;
    },
  });

  const { data: specialties } = useQuery({
    queryKey: ['specialties'],
    queryFn: async () => {
      const res = await api.get('/admin/specialties');
      return res.data;
    },
  });

  const { data: drugClasses } = useQuery({
    queryKey: ['drug-classes'],
    queryFn: async () => {
      const res = await api.get('/admin/drug-classes');
      return res.data;
    },
  });

  const add = useMutation({
    mutationFn: () => api.post('/admin/specialty-drug-class', form),
    onSuccess: () => {
      setForm({ specialtyId: '', drugClassId: '' });
      queryClient.invalidateQueries({ queryKey: ['specialty-drug-class'] });
      toast.success('Authorization added');
    },
    onError: () => toast.error('Failed to add authorization'),
  });

  const remove = useMutation({
    mutationFn: (body: { specialtyId: string; drugClassId: string }) =>
      api.delete('/admin/specialty-drug-class', { data: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialty-drug-class'] });
      toast.success('Authorization removed');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Prescribing Authorizations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Define which medical specialties are authorized to prescribe each drug class.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="flex gap-2"
        >
          <select
            className="flex h-10 flex-1 appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={form.specialtyId}
            onChange={(e) => setForm((f) => ({ ...f, specialtyId: e.target.value }))}
          >
            <option value="">Select specialty...</option>
            {specialties?.items?.map((s: { id: string; name: string }) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className="flex h-10 flex-1 appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={form.drugClassId}
            onChange={(e) => setForm((f) => ({ ...f, drugClassId: e.target.value }))}
          >
            <option value="">Select drug class...</option>
            {drugClasses?.items?.map((dc: { id: string; name: string }) => (
              <option key={dc.id} value={dc.id}>{dc.name}</option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={!form.specialtyId || !form.drugClassId || add.isPending}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </form>
        <div className="space-y-2">
          {data?.items?.map(
            (auth: {
              specialtyId: string;
              drugClassId: string;
              specialty: { name: string };
              drugClass: { name: string };
            }) => (
              <div
                key={`${auth.specialtyId}-${auth.drugClassId}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">{auth.specialty.name}</Badge>
                  <span className="text-muted-foreground">can prescribe</span>
                  <Badge variant="secondary" className="text-xs">{auth.drugClass.name}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate({ specialtyId: auth.specialtyId, drugClassId: auth.drugClassId })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          )}
          {!data?.items?.length && (
            <p className="text-sm text-muted-foreground">No authorizations configured</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Insurance Policies ─── */
function InsurancePoliciesSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ carrier: '', memberNumber: '', coveragePercent: '' });

  const { data } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: async () => {
      const res = await api.get('/admin/insurance-policies');
      return res.data;
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/insurance-policies', {
        ...form,
        coveragePercent: Number(form.coveragePercent),
      }),
    onSuccess: () => {
      setForm({ carrier: '', memberNumber: '', coveragePercent: '' });
      queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      toast.success('Insurance policy created');
    },
    onError: () => toast.error('Failed to create policy'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileHeart className="h-5 w-5 text-primary" />
          Insurance Policies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="grid gap-3 sm:grid-cols-4"
        >
          <Input
            placeholder="Carrier name"
            value={form.carrier}
            onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
          />
          <Input
            placeholder="Member number"
            value={form.memberNumber}
            onChange={(e) => setForm((f) => ({ ...f, memberNumber: e.target.value }))}
          />
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="Coverage %"
            value={form.coveragePercent}
            onChange={(e) => setForm((f) => ({ ...f, coveragePercent: e.target.value }))}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!form.carrier || !form.memberNumber || !form.coveragePercent || create.isPending}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </form>
        <div className="space-y-2">
          {data?.items?.map(
            (p: { id: string; carrier: string; memberNumber: string; coveragePercent: number }) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileHeart className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.carrier}</p>
                    <p className="text-xs text-muted-foreground">{p.memberNumber}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {p.coveragePercent}% coverage
                </Badge>
              </div>
            ),
          )}
          {!data?.items?.length && (
            <p className="text-sm text-muted-foreground">No insurance policies configured</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
