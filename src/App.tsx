import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Login from './pages/Login';
import Chat from './pages/Chat';
import { UserProvider } from './contexts/UserContext';
import HamburgerMenu from './components/HamburgerMenu';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UserProvider>
      <BrowserRouter>
        <div className="flex h-screen bg-[#1A1D21]">
          <HamburgerMenu isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
          <Sidebar isOpen={sidebarOpen} />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </div>
      </BrowserRouter>
    </UserProvider>
  );
}