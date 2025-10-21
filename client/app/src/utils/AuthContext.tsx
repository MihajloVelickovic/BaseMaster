import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axiosInstance from './axiosInstance';

interface AuthContextType {
  playerID: string | null;
  setPlayerID: (id: string | null) => void;
  login: (username: string) => void;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playerID, setPlayerIDState] = useState<string | null>(() => {
    // Initialize from localStorage if available
    return localStorage.getItem('playerID');
  });

  const login = (username: string) => {
    setPlayerIDState(username);
    localStorage.setItem('playerID', username);
  };

  const logout = async () => {
    try {
      // Get refresh token from localStorage
      const refreshToken = localStorage.getItem('refreshTok');
      
      if (refreshToken) {
        // Call backend logout endpoint
        await axiosInstance.post('/user/logout', {
          token: refreshToken
        });
      }
    } catch (error) {
      // Continue with local cleanup even if backend call fails
    } finally {
      // Always clear local state, even if backend call fails
      setPlayerIDState(null);
      localStorage.removeItem('playerID');
      localStorage.removeItem('accessTok');
      localStorage.removeItem('refreshTok');
    }
  };

  const setPlayerID = (id: string | null) => {
    setPlayerIDState(id);
    if (id) {
      localStorage.setItem('playerID', id);
    } else {
      localStorage.removeItem('playerID');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      playerID, 
      setPlayerID, 
      login, 
      logout, 
      isLoggedIn: !!playerID 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};