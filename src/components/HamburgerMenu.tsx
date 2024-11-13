import React from 'react';
import { Menu, X } from 'lucide-react';

interface HamburgerMenuProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, setIsOpen }) => {
  return (
    <button 
      onClick={() => setIsOpen(!isOpen)} 
      className="fixed top-4 left-4 z-50 p-2 bg-black hover:bg-zinc-900 rounded-lg transition-colors lg:hidden"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <Menu className="w-6 h-6 text-white" />
      )}
    </button>
  );
};

export default HamburgerMenu;