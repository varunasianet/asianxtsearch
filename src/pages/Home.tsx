import React from 'react';
import SearchBar from '../components/SearchBar';
import SuggestedQueries from '../components/SuggestedQueries';
import Logo from '../components/Logo';

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center px-8 py-16 animate-fadeIn">
      <Logo size="lg" className="mb-4" />
      <div className="text-center mb-8">
        <div className="flex flex-col items-center">
          <div className="flex items-start justify-center mb-2">
            <h1 className="text-3xl font-medium text-white animate-slideDown">Huduku</h1>
            <span className="text-[10px] text-gray-400 ml-1.5 mt-1.5 font-light tracking-wide">
              Powered by Asianxt
            </span>
          </div>
          <p className="text-cyan-200 text-base font-light tracking-wider animate-slideDown">
            Your Intelligent News Companion
          </p>
        </div>
      </div>
      <div className="w-full max-w-3xl animate-slideUp">
        <SearchBar />
        <SuggestedQueries />
      </div>
    </main>
  );
}