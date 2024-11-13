import React from 'react';

interface LogoProps {
  size?: 'sm' | 'lg';
  className?: string;
}

export default function Logo({ size = 'sm', className = '' }: LogoProps) {
  const dimensions = size === 'lg' ? 64 : 32;
  
  return (
    <img 
      src="/home/varun_saagar/asianxtsearch/src/Anxt_Search_logo.svg"
      width={dimensions} 
      height={dimensions} 
      alt="Asianxt Search Logo"
      className={className}
    />
  );
}