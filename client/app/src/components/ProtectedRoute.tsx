import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component - wraps routes that require authentication
 * Redirects to /LoginSignup if user is not logged in
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { playerID, isLoggedIn } = useAuth();

  // If user is not logged in, redirect to login page
  if (!isLoggedIn || !playerID) {
    return <Navigate to="/LoginSignup" replace />;
  }

  // If user is logged in, render the protected component
  return <>{children}</>;
};

export default ProtectedRoute;
