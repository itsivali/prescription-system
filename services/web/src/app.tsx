import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Providers } from '@/lib/providers';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardLayout } from '@/components/dashboard-layout';
import { RoleRedirect } from '@/components/role-redirect';

const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));
const DoctorDashboard = lazy(() => import('@/pages/doctor').then((m) => ({ default: m.DoctorDashboard })));
const PharmacistDashboard = lazy(() => import('@/pages/pharmacist').then((m) => ({ default: m.PharmacistDashboard })));
const AdminDashboard = lazy(() => import('@/pages/admin').then((m) => ({ default: m.AdminDashboard })));

/**
 * Invisible fallback — the layout skeleton is already shown by ProtectedRoute,
 * so lazy-loaded page chunks don't need a second loading indicator.
 */
function InvisibleFallback() {
  return <div className="flex-1" />;
}

export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <Suspense fallback={<InvisibleFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Protected dashboard routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<RoleRedirect />} />
                <Route path="doctor/*" element={<DoctorDashboard />} />
                <Route path="pharmacist/*" element={<PharmacistDashboard />} />
                <Route path="admin/*" element={<AdminDashboard />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Providers>
    </BrowserRouter>
  );
}
