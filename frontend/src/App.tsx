import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { UnsavedChangesProvider } from './navigation/UnsavedChangesProvider'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { DashboardPage } from './pages/DashboardPage'
import { FleetPage } from './pages/FleetPage'
import { LoginPage } from './pages/LoginPage'
import { MissionDetailPage } from './pages/MissionDetailPage'
import { MissionPlanPage } from './pages/MissionPlanPage'
import { MissionsPage } from './pages/MissionsPage'
import { NewMissionPage } from './pages/NewMissionPage'
import { ProfilePage } from './pages/ProfilePage'
import { RequestPasswordResetPage } from './pages/RequestPasswordResetPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

// swagger-ui is a couple of megabytes and only an admin on one page ever needs
// it, so it stays out of the main bundle
const ApiDocsPage = lazy(() =>
  import('./pages/ApiDocsPage').then((m) => ({ default: m.ApiDocsPage })),
)

function App() {
  return (
    <AuthProvider>
      <UnsavedChangesProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/request-password-reset" element={<RequestPasswordResetPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/missions" replace />} />
              <Route path="/missions" element={<MissionsPage />} />
              <Route path="/missions/new" element={<NewMissionPage />} />
              <Route path="/missions/:id" element={<MissionDetailPage />} />
              <Route path="/missions/:id/plan" element={<MissionPlanPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/fleet" element={<FleetPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/api-docs"
                element={
                  <Suspense fallback={<p className="text-dim">Loading...</p>}>
                    <ApiDocsPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Routes>
      </UnsavedChangesProvider>
    </AuthProvider>
  )
}

export default App
