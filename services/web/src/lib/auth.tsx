import { createContext, useContext, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api, { fetchCsrfToken } from './api';

export type Role = 'DOCTOR' | 'PHARMACIST' | 'ADMIN';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  doctorProfile?: {
    specialty: { name: string };
    department: { name: string };
  } | null;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  oauthLogin: (provider: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: user = null,
    isLoading,
    isFetching,
  } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.get('/auth/me');
        return res.data;
      } catch (err) {
        // 401/403 = not authenticated — return null (not an error).
        // This prevents the query from staying in error state and keeps
        // the app usable (ProtectedRoute redirects to /login).
        if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
          return null;
        }
        // Genuine network/server errors still throw so react-query can retry.
        throw err;
      }
    },
    retry: (failureCount, error) => {
      // Don't retry auth failures — only retry transient errors (network, 5xx).
      if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Pre-fetch CSRF token once on mount — non-blocking, fire-and-forget.
  useEffect(() => {
    fetchCsrfToken().catch(() => {});
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await api.post('/auth/login', { email, password });
      return res.data.user as User;
    },
    onSuccess: (u) => {
      queryClient.setQueryData(['auth', 'me'], u);
    },
  });

  const login = useCallback(
    (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    [loginMutation],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    queryClient.setQueryData(['auth', 'me'], null);
    queryClient.clear();
  }, [queryClient]);

  const oauthLogin = useCallback((provider: string) => {
    window.location.href = `/api/auth/oauth/${provider}`;
  }, []);

  // Loading = initial fetch only, not background refetches.
  // This prevents the spinner from re-appearing on stale refetches.
  const initiallyLoading = isLoading && isFetching;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: initiallyLoading,
        isAuthenticated: !!user,
        login,
        logout,
        oauthLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
