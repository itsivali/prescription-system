import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/** Redirects authenticated users to their role-specific dashboard. */
export function RoleRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
}
