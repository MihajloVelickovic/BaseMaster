import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import Header from './components/Header';
import Lobby from './components/Lobby';
import LoginSignup from './components/LoginSignup';
import FriendList from './components/FriendList'
import "./styles/AppRoutes.css";
import { FriendProvider } from './utils/FriendContext';
import { LobbyProvider } from "./utils/LobbyContext";
import Profile from './components/Profile';
import { AuthProvider, useAuth } from './utils/AuthContext';
import Leaderboard from './components/Leaderboard';
import { WebSocketProvider } from './utils/WebSocketContext';
import ProtectedRoute from './components/ProtectedRoute';

// Public routes - accessible without authentication
const publicRoutes = [
    { path: "/", element: <Home /> },
    { path: "/LoginSignup", element: <LoginSignup /> },
];

// Protected routes - require authentication
const protectedRoutes = [
    { path: "/Game", element: <Game /> },
    { path: "/Lobby", element: <Lobby /> },
    { path: "/FriendList", element: <FriendList /> },
    { path: "/Profile", element: <Profile /> },
    { path: "/Leaderboard", element: <Leaderboard /> }
];

// Inner component that has access to AuthContext
const AppContent = () => {
    const { playerID } = useAuth();

    return (
        <WebSocketProvider username={playerID}>
            <FriendProvider>
                <LobbyProvider>
                    <Header />
                    <div className='BelowHeader'>
                        <Routes>
                            {/* Public routes - no authentication required */}
                            {publicRoutes.map((route, index) => (
                                <Route key={`public-${index}`} path={route.path} element={route.element} />
                            ))}

                            {/* Protected routes - authentication required */}
                            {protectedRoutes.map((route, index) => (
                                <Route
                                    key={`protected-${index}`}
                                    path={route.path}
                                    element={
                                        <ProtectedRoute>
                                            {route.element}
                                        </ProtectedRoute>
                                    }
                                />
                            ))}
                        </Routes>
                    </div>
                </LobbyProvider>
            </FriendProvider>
        </WebSocketProvider>
    );
};

const AppRoutes = () => {       //Header se poziva odavde, moze i iz index.tsx ali mora da bude i tamo BrowswerRouter
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </AuthProvider>
    );
};

export default AppRoutes;
