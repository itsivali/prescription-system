import { Routes, Route } from 'react-router-dom';
import { RoleGuard } from '@/components/role-guard';
import { PharmacistHome } from './home';
import { DispensationsPage } from './dispensations';
import { InventoryPage } from './inventory';
import { ScanPage } from './scan';

export function PharmacistDashboard() {
  return (
    <RoleGuard allowedRoles={['PHARMACIST']}>
      <Routes>
        <Route index element={<PharmacistHome />} />
        <Route path="dispensations" element={<DispensationsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="scan" element={<ScanPage />} />
      </Routes>
    </RoleGuard>
  );
}
