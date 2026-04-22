import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Plus, X } from 'lucide-react';

type Doctor = {
  id: string;
  userId: string;
  licenseNo: string;
  user: { id: string; email: string; fullName: string; role: string; isActive: boolean };
  specialty: { name: string };
  department: { name: string };
};

const doctorColumns: Column<Doctor>[] = [
  { key: 'name', header: 'Name', render: (r) => r.user.fullName },
  { key: 'email', header: 'Email', render: (r) => r.user.email },
  { key: 'license', header: 'License', render: (r) => r.licenseNo },
  { key: 'specialty', header: 'Specialty', render: (r) => r.specialty.name },
  { key: 'department', header: 'Department', render: (r) => r.department.name },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <Badge variant={r.user.isActive ? 'success' : 'secondary'}>
        {r.user.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

export function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const res = await api.get('/doctors');
      return res.data as { items: Doctor[] };
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showForm ? 'Cancel' : 'Create User'}
        </Button>
      </div>

      {showForm && (
        <CreateUserForm
          onDone={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
          }}
        />
      )}

      <DataTable
        columns={doctorColumns}
        data={doctors?.items ?? []}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No users found."
      />
    </div>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'DOCTOR' as string,
    licenseNo: '',
    departmentId: '',
    specialtyId: '',
  });
  const [error, setError] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/admin/departments');
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

  const create = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
      };
      if (form.role === 'DOCTOR') {
        body.doctor = {
          licenseNo: form.licenseNo,
          departmentId: form.departmentId,
          specialtyId: form.specialtyId,
        };
      }
      await api.post('/auth/users', body);
    },
    onSuccess: () => onDone(),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to create user';
      setError(msg);
    },
  });

  const filteredSpecialties = specialties?.items?.filter(
    (s: { departmentId: string }) => s.departmentId === form.departmentId,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create New User</CardTitle>
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
            <Label>Full Name</Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Password (min 12 chars)</Label>
            <Input
              type="password"
              minLength={12}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {form.role === 'DOCTOR' && (
            <>
              <div className="space-y-2">
                <Label>License Number</Label>
                <Input
                  value={form.licenseNo}
                  onChange={(e) => setForm((f) => ({ ...f, licenseNo: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, departmentId: e.target.value, specialtyId: '' }))
                  }
                  required
                >
                  <option value="">Select department...</option>
                  {departments?.items?.map((d: { id: string; name: string }) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Specialty</Label>
                <select
                  className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-8 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.specialtyId}
                  onChange={(e) => setForm((f) => ({ ...f, specialtyId: e.target.value }))}
                  required
                >
                  <option value="">Select specialty...</option>
                  {filteredSpecialties?.map((s: { id: string; name: string }) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="col-span-full flex justify-end gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
