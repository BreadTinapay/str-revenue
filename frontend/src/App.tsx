import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider, RequireAdmin, RequireAuth } from "./lib/auth";
import { useScrollLockGuard } from "./lib/useScrollLockGuard";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const LeadDetailPage = lazy(() => import("./pages/LeadDetailPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const CampaignDetailPage = lazy(() => import("./pages/CampaignDetailPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLogPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function App() {
  useScrollLockGuard();

  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/leads/:leadId" element={<LeadDetailPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/account/password" element={<ChangePasswordPage />} />
              <Route
                path="/users"
                element={
                  <RequireAdmin>
                    <UsersPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/activity"
                element={
                  <RequireAdmin>
                    <ActivityLogPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAdmin>
                    <SettingsPage />
                  </RequireAdmin>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/leads" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
