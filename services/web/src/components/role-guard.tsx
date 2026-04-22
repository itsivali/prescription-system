import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '@/lib/auth';

/**
 * Client-side role guard. Redirects users who don't have the required role
 * to their own dashboard.
 */
export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  return <>{children}</>;
}
