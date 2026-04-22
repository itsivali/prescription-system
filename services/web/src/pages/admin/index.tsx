import { Routes, Route } from 'react-router-dom';
import { RoleGuard } from '@/components/role-guard';
import { AdminHome } from './home';
import { UsersPage } from './users';
import { AuditPage } from './audit';
import { BillingPage } from './billing';
import { SettingsPage } from './settings';

export function AdminDashboard() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </RoleGuard>
  );
}
