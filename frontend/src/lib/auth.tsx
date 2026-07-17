import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { clearToken, getToken, login as apiLogin, setToken } from "./api";

interface AuthContextValue {
  isAuthenticated: boolean;
  role: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_KEY = "str_revenue_role";
const EMAIL_KEY = "str_revenue_email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem(ROLE_KEY));
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(EMAIL_KEY));

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, role } = await apiLogin(email, password);
    setToken(access_token);
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem(EMAIL_KEY, email);
    setIsAuthenticated(true);
    setRole(role);
    setEmail(email);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setIsAuthenticated(false);
    setRole(null);
    setEmail(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, role, email, login, logout }),
    [isAuthenticated, role, email, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/leads" replace />;
  return <>{children}</>;
}
