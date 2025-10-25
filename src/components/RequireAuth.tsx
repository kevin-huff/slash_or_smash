import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { checkAuthStatus } from '../api/auth';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const status = await checkAuthStatus();
        setIsAuthenticated(status.isAuthenticated);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    }

    void checkAuth();
  }, []);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-900">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-witchlight-500 border-t-transparent"></div>
          <p className="text-specter-300">Checking authentication...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/control/login" replace />;
  }

  return <>{children}</>;
}
