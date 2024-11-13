import React from 'react';
import { Home, Compass, Box, Library, ArrowUpRight, LogIn } from './Icons';
import { NavLink, useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import { useUser } from '../contexts/UserContext';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  text: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, text }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-zinc-900 text-white'
          : 'text-gray-400 hover:bg-zinc-900 hover:text-white'
      }`
    }
  >
    {icon}
    <span>{text}</span>
  </NavLink>
);

export default function Sidebar({ isOpen }) {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={`w-64 h-screen bg-black border-r border-zinc-800 p-4 flex flex-col ${isOpen ? '' : 'hidden'}`}>
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity"
      >
        <div className="text-cyan-400 text-2xl">⬡</div>
        <span className="text-white text-xl font-semibold">Asianet News Pro</span>
      </button>
      
      <button className="w-full bg-zinc-900 text-white rounded-full py-2 px-4 mb-6 flex items-center gap-2">
        <span>New Thread</span>
        <span className="text-gray-400 text-sm">Ctrl I</span>
      </button>

      <nav className="flex flex-col gap-2">
        <NavItem to="/" icon={<Home size={20} />} text="Home" />
        <NavItem to="/discover" icon={<Compass size={20} />} text="Discover" />
        <NavItem to="/spaces" icon={<Box size={20} />} text="Spaces" />
        <NavItem to="/library" icon={<Library size={20} />} text="Library" />
      </nav>

      {user ? (
        <UserProfile
          email={user.email}
          picture={user.picture}
          name={user.name}
        />
      ) : (
        <button 
          onClick={() => navigate('/login')}
          className="mt-4 w-full bg-[#00A3A3] hover:bg-[#00B3B3] text-white rounded-lg py-2 px-4 flex items-center gap-2 justify-center transition-colors"
        >
          <LogIn size={20} />
          <span>Sign In</span>
        </button>
      )}

      <div className="mt-auto">
        <div className="bg-zinc-900 rounded-lg p-4">
          <h3 className="text-white font-medium mb-2">Try Pro</h3>
          <p className="text-gray-400 text-sm mb-3">
            Upgrade for image upload, smarter AI, and more Pro Search.
          </p>
          <button className="text-gray-300 text-sm flex items-center gap-1 hover:text-white">
            Learn More
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}