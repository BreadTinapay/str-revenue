import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { useScrollLockGuard } from "./lib/useScrollLockGuard";
import AnalyticsPage from "./pages/AnalyticsPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import LeadsPage from "./pages/LeadsPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  useScrollLockGuard();

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:leadId" element={<LeadDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/leads" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
