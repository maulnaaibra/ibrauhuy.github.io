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
      <div className="min-h-screen bg-[#0e0f11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#ededef] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#9aa0ac]">Memeriksa sesi akun...</span>
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
