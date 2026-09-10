import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type AuthUser, type Role } from '../api';

export type { AuthUser, Role };

/** Rank order for permission checks: admin > checker > maker > staff. */
const ROLE_RANK: Record<Role, number> = {
  staff: 1,
  maker: 2,
  checker: 3,
  admin: 4,
};

/** True when `role` holds at least `min` (a maker passes min 'maker'; so do checker/admin). */
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isChecker: boolean;
  isMaker: boolean;
  isStaff: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the kbj_session cookie on first mount (401 → anonymous).
  useEffect(() => {
    let isMounted = true;
    api
      .getCurrentUser()
      .then((sessionUser) => {
        if (isMounted) setUser(sessionUser);
      })
      .catch((err) => {
        // Server unreachable: stay anonymous; the api layer raises the offline flag.
        console.warn('Session restore failed:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    try {
      const loggedIn = await api.login(username, password);
      setUser(loggedIn);
      return { success: true };
    } catch (err) {
      const error = err instanceof ApiError ? err.message : 'Login failed — please try again';
      return { success: false, error };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      // Clear the local session even if the server call fails.
      console.warn('Logout call failed:', err);
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'admin',
      isChecker: user?.role === 'checker',
      isMaker: user?.role === 'maker',
      isStaff: user?.role === 'staff',
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
