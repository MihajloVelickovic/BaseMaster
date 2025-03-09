import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Game from './components/Game';
import Header from './components/Header';
import Lobby from './components/Lobby';
import "./styles/AppRoutes.css";

const routes = [
    { path: "/", element: <Home /> },
    { path: "/Game", element: <Game />},
    { path: "/Lobby", element: <Lobby />}
    // { path: "/login", element: <LoginSignupPage /> },
    // { path: "/register/:token", element: <Register /> },
];

const AppRoutes = () => {       //Header se poziva odavde, moze i iz index.tsx ali mora da bude i tamo BrowswerRouter
    return (
        <BrowserRouter>
            <Header />
            <div className='BelowHeader'>
                <Routes>
                    {routes.map((route, index) => (
                        <Route key={index} path={route.path} element={route.element} />
                    ))}
                </Routes>
            </div>
        </BrowserRouter>
    );
};

export default AppRoutes;
