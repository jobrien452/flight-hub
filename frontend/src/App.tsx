import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { MissionsPage } from './pages/MissionsPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/missions" replace />} />
            <Route path="/missions" element={<MissionsPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
