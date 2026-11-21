import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading, passwordRecoveryMode } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen app-bg-canvas flex items-center justify-center">
        <div className="card-pro px-6 py-5 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-600">
            Memeriksa sesi akun...
          </span>
        </div>
      </div>
    );
  }

  if (passwordRecoveryMode) {
    return <Navigate to="/login?mode=reset" replace />;
  }

  if (!user) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to="/login" state={{ from: target }} replace />;
  }

  return <>{children}</>;
};
