import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { LoginPage } from './pages/LoginPage'
import { MissionDetailPage } from './pages/MissionDetailPage'
import { MissionsPage } from './pages/MissionsPage'
import { NewMissionPage } from './pages/NewMissionPage'
import { RequestPasswordResetPage } from './pages/RequestPasswordResetPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function App() {
  return (
    <AuthProvider>
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
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
