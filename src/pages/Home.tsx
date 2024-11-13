import React from 'react';
import SearchBar from '../components/SearchBar';
import SuggestedQueries from '../components/SuggestedQueries';
import Logo from '../components/Logo';

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center px-8 py-16 animate-fadeIn">
      <Logo size="lg" className="mb-6" />
      <h1 className="text-white text-5xl font-medium mb-12 animate-slideDown">
        Asianxt Search
      </h1>
      <div className="w-full max-w-3xl animate-slideUp">
        <SearchBar />
        <SuggestedQueries />
      </div>
    </main>
  );
}