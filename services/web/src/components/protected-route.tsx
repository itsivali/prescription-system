import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/**
 * Shows the dashboard layout skeleton while auth is loading,
 * so users see the UI structure immediately — no blank screen or spinner.
 */
function DashboardSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background animate-fade-in">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="h-9 w-9 rounded-xl animate-skeleton" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-20 rounded animate-skeleton" />
            <div className="h-2.5 w-28 rounded animate-skeleton" />
          </div>
        </div>
        <div className="mx-4 h-px bg-sidebar-border" />
        <div className="flex-1 space-y-5 p-4 pt-5">
          <div className="space-y-1">
            <div className="h-2.5 w-16 rounded animate-skeleton mb-2" />
            <div className="h-8 w-full rounded-lg animate-skeleton" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-14 rounded animate-skeleton mb-2" />
            <div className="h-8 w-full rounded-lg animate-skeleton" />
            <div className="h-8 w-full rounded-lg animate-skeleton" />
            <div className="h-8 w-full rounded-lg animate-skeleton" />
          </div>
        </div>
      </aside>

      {/* Main area skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topnav skeleton */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
          <div className="space-y-1.5">
            <div className="h-4 w-44 rounded animate-skeleton" />
            <div className="h-2.5 w-32 rounded animate-skeleton" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg animate-skeleton" />
            <div className="h-8 w-8 rounded-full animate-skeleton" />
          </div>
        </header>

        {/* Content skeleton */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="h-6 w-40 rounded animate-skeleton" />
              <div className="h-3.5 w-56 rounded animate-skeleton" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-2.5 w-20 rounded animate-skeleton" />
                      <div className="h-6 w-12 rounded animate-skeleton" />
                    </div>
                    <div className="h-10 w-10 rounded-xl animate-skeleton" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <div className="h-4 w-36 rounded animate-skeleton mb-4" />
                  <div className="space-y-2.5">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-14 w-full rounded-lg animate-skeleton" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
