import React from 'react';

interface LogoProps {
  size?: 'sm' | 'lg';
  className?: string;
}

export default function Logo({ size = 'sm', className = '' }: LogoProps) {
  const dimensions = size === 'lg' ? 64 : 32;
  
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: dimensions, height: dimensions }}>
      <img 
        src="/assets/Huduku_ai_logo.svg" 
        alt="Huduku AI Logo"
        className="w-full h-full"
        style={{ width: dimensions, height: dimensions }}
      />
    </div>
  );
}