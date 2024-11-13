import React, { useEffect, useState, useCallback } from 'react';
import { Mountain, ThumbsUp, TrendingUp, Tv, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface QueryData {
  query: string;
  category: string;
  icon: string;
  color: string;
  priority?: number;
  timestamp?: string;
  news_title?: string;
}

const FALLBACK_QUERIES: QueryData[] = [
  {
    query: "Latest technology trends in AI",
    category: "TECHNOLOGY",
    icon: "trending-up",
    color: "blue"
  },
  {
    query: "Top entertainment news today",
    category: "ENTERTAINMENT",
    icon: "tv",
    color: "purple"
  },
  {
    query: "Current market analysis",
    category: "BUSINESS",
    icon: "trending-up",
    color: "green"
  },
  {
    query: "Global headlines",
    category: "WORLD",
    icon: "globe",
    color: "yellow"
  }
];

const QueryCard: React.FC<{ icon: React.ReactNode; title: string; onClick: () => void }> = ({ 
  icon, 
  title, 
  onClick 
}) => (
  <button 
    onClick={onClick}
    className="bg-zinc-900 rounded-xl p-4 text-left hover:bg-zinc-800 transition-colors w-full"
  >
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
        {icon}
      </div>
      <span className="text-white font-medium line-clamp-2">{title}</span>
    </div>
  </button>
);

export default function SuggestedQueries() {
  const navigate = useNavigate();
  const [queries, setQueries] = useState<QueryData[]>(FALLBACK_QUERIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const fetchQueries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSuggestedQueries();
      
      if (data?.queries && Array.isArray(data.queries)) {
        setQueries(data.queries);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error('Invalid data structure received');
      }
    } catch (error) {
      console.error('Error fetching queries:', error);
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchQueries(), 2000 * (retryCount + 1)); // Exponential backoff
      } else {
        setError('Unable to fetch latest queries. Showing default suggestions.');
        setQueries(FALLBACK_QUERIES);
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const handleQueryClick = (query: string) => {
    navigate('/chat', { state: { initialQuery: query } });
  };

  const getIcon = (iconName: string): React.ReactNode => {
    const iconProps = { className: "w-6 h-6 text-current" };
    switch (iconName.toLowerCase()) {
      case 'trending-up': return <TrendingUp {...iconProps} />;
      case 'tv': return <Tv {...iconProps} />;
      case 'mountain': return <Mountain {...iconProps} />;
      case 'thumbs-up': return <ThumbsUp {...iconProps} />;
      case 'globe': return <Globe {...iconProps} />;
      default: return <TrendingUp {...iconProps} />;
    }
  };

  const getColorClass = (color: string): string => ({
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500'
  }[color] || 'text-blue-500');

  return (
    <div className="w-full max-w-3xl mt-6 px-4">
      {loading && (
        <div className="text-center mb-4">
          <LoadingSpinner />
        </div>
      )}
      
      {error && (
        <div className="text-center mb-4">
          <p className="text-amber-500 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {queries.map((query, index) => (
          <QueryCard
            key={`${query.query}-${index}`}
            icon={
              <div className={getColorClass(query.color)}>
                {getIcon(query.icon)}
              </div>
            }
            title={query.query}
            onClick={() => handleQueryClick(query.query)}
          />
        ))}
      </div>
    </div>
  );
}