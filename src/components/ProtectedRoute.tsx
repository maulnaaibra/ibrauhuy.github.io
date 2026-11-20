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
      <div className="min-h-screen bg-gradient-to-b from-red-50/50 via-white to-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-500">
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
