import React from 'react';
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
import Sidebar from './components/Sidebar';
import { AuthProvider } from './utils/AuthContext';
import Leaderboard from './components/Leaderboard';


const routes = [
    { path: "/", element: <Home /> },
    { path: "/Game", element: <Game />},
    { path: "/Lobby", element: <Lobby />},
    { path: "/LoginSignup", element: <LoginSignup />},
    { path: "/FriendList", element: <FriendList />},
    {path:"/Profile", element:<Profile/>},
    {path:"/Leaderboard", element:<Leaderboard/>}
    // { path: "/login", element: <LoginSignupPage /> },
    // { path: "/register/:token", element: <Register /> },
];

const AppRoutes = () => {       //Header se poziva odavde, moze i iz index.tsx ali mora da bude i tamo BrowswerRouter
    return (
        <AuthProvider>
        <BrowserRouter>
        <FriendProvider>
        <LobbyProvider>
            <Header />
            <div className='BelowHeader'>
                <Routes>
                    {routes.map((route, index) => (
                        <Route key={index} path={route.path} element={route.element} />
                    ))}
                </Routes>
            </div>
        </LobbyProvider>
        </FriendProvider>
        </BrowserRouter>
        </AuthProvider>
    );
};

export default AppRoutes;
