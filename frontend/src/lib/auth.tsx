import { createContext, useContext, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { clearToken, getToken, login as apiLogin, setToken } from "./api";

interface AuthContextValue {
  isAuthenticated: boolean;
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_KEY = "str_revenue_role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem(ROLE_KEY));

  async function login(email: string, password: string) {
    const { access_token, role } = await apiLogin(email, password);
    setToken(access_token);
    localStorage.setItem(ROLE_KEY, role);
    setIsAuthenticated(true);
    setRole(role);
  }

  function logout() {
    clearToken();
    localStorage.removeItem(ROLE_KEY);
    setIsAuthenticated(false);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>{children}</AuthContext.Provider>
  );
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
