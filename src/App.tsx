import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { LegalPage } from './pages/LegalPage';
import { PublicProfilePage } from './pages/PublicProfilePage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111c2d',
              color: '#f3f7fc',
              border: '1px solid rgba(148, 179, 214, 0.22)',
              borderRadius: '12px',
              fontWeight: 600,
              boxShadow: '0 12px 28px -6px rgba(4, 9, 17, 0.55)',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/auth/callback" element={<AuthPage />} />
          <Route path="/u/:handle" element={<PublicProfilePage />} />
          <Route path="/profile/:handle" element={<PublicProfilePage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <PublicProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/showcase" element={<LandingPage />} />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
