import { Routes, Route } from 'react-router-dom';
import { RoleGuard } from '@/components/role-guard';
import { DoctorHome } from './home';
import { PatientsPage } from './patients';
import { PatientDetailPage } from './patient-detail';
import { PrescriptionsPage } from './prescriptions';
import { EncountersPage } from './encounters';

export function DoctorDashboard() {
  return (
    <RoleGuard allowedRoles={['DOCTOR']}>
      <Routes>
        <Route index element={<DoctorHome />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="encounters" element={<EncountersPage />} />
      </Routes>
    </RoleGuard>
  );
}
