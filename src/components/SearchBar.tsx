import React, { useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      const searchResults = await api.search({ query });
      navigate('/chat', { 
        state: { 
          initialQuery: query,
          searchResults 
        } 
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything..."
          className="w-full bg-zinc-900 text-white rounded-xl py-4 pl-12 pr-24 outline-none focus:ring-2 focus:ring-cyan-400/20"
          disabled={loading}
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <Search size={20} className="text-gray-400" />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#00A3A3] text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-[#00B3B3] transition-colors disabled:opacity-50"
        >
          <span>{loading ? 'Searching...' : 'Search'}</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </form>
  );
}