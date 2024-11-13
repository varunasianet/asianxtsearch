import React from 'react';
import { Home, LogIn, ArrowLeft } from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import UserProfile from './UserProfile';
import { useUser } from '../contexts/UserContext';
import Logo from './Logo';

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
  const location = useLocation();
  const { user, isLoading } = useUser();

  const handleNavigation = () => {
    if (location.pathname === '/') {
      window.location.reload();
    } else {
      navigate('/');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={`w-64 h-screen bg-black border-r border-zinc-800 p-4 flex flex-col ${isOpen ? '' : 'hidden lg:flex'}`}>
      <div className="h-14 flex items-center"> {/* Fixed height header */}
        <button 
          onClick={handleNavigation}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
        >
          {location.pathname !== '/' && (
            <ArrowLeft size={20} className="text-white" />
          )}
          <Logo size="sm" />
          <span className="text-white text-xl font-semibold">Huduku AI</span>
        </button>
      </div>

      <nav className="flex flex-col gap-2 mt-6">
        <NavItem to="/" icon={<Home size={20} />} text="Home" />
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
          className="mt-4 w-full bg-white hover:bg-gray-100 text-black rounded-lg py-2 px-4 flex items-center gap-2 justify-center transition-colors"
        >
          <LogIn size={20} />
          <span>Sign In</span>
        </button>
      )}

      <div className="mt-auto">
        <div className="bg-zinc-900 rounded-lg p-4">
          <h3 className="text-white font-medium mb-2">Contact Us</h3>
          <a href="mailto:abhijeet.prahlad@asianetnews.in" className="text-gray-400 text-sm hover:text-white transition-colors">
            abhijeet.prahlad@asianetnews.in
          </a>
        </div>
      </div>
    </div>
  );
}