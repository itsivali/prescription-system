import { useLocation } from 'react-router-dom';

/**
 * Wraps page content in a consistent fade-in + slide-up animation.
 * Uses the route pathname as key so transitions replay on navigation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
