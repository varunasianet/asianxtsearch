import React from 'react';
import { Search } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'lg';
  className?: string;
}

export default function Logo({ size = 'sm', className = '' }: LogoProps) {
  const dimensions = size === 'lg' ? 64 : 32;
  
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: dimensions, height: dimensions }}>
      <Search size={dimensions} className="text-[#00A3A3]" />
    </div>
  );
}