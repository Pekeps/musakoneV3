import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { useLocation } from 'wouter';
import { currentUser } from '../stores/auth';
import { isAuthenticated } from '../services/auth';

interface ProtectedRouteProps {
  children: any;
}

/**
 * Wrapper component that redirects to /login if user is not authenticated
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = useStore(currentUser);
  const [location, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const hasAuth = isAuthenticated() || user !== null;
    
    if (!hasAuth && location !== '/login' && location !== '/register') {
      console.log('Not authenticated, redirecting to /login');
      setLocation('/login');
    }
    
    setChecking(false);
  }, [user, location, setLocation]);

  // Show nothing while checking (prevents flash)
  if (checking) {
    return null;
  }

  // If not authenticated and not on public route, don't render
  if (!user && !isAuthenticated() && location !== '/login' && location !== '/register') {
    return null;
  }

  return <>{children}</>;
}
