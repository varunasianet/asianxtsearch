import React, { useEffect, useState, useCallback } from 'react';
import { Mountain, ThumbsUp, TrendingUp, Tv, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface QueryData {
  query: string;
  category: string;
  icon: string;
  color: string;
  priority?: number;
  timestamp?: string;
  news_title?: string;
}

interface QueryCardProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
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

const QueryCard: React.FC<QueryCardProps> = ({ icon, title, onClick }) => {
  return (
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
};

const SuggestedQueries: React.FC = () => {
  const navigate = useNavigate();
  const [queries, setQueries] = useState<QueryData[]>(FALLBACK_QUERIES);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchQueries = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    
    if (timeSinceLastFetch < 60000) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.getSuggestedQueries();
      
      if (data?.queries && Array.isArray(data.queries)) {
        setQueries(data.queries);
        setLastFetchTime(now);
      } else {
        throw new Error('Invalid data structure received from server');
      }
    } catch (error) {
      console.error('Error fetching queries:', error);
      setError('Unable to fetch latest queries. Showing default suggestions.');
      setQueries(FALLBACK_QUERIES);
    } finally {
      setLoading(false);
    }
  }, [lastFetchTime]);

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout;

    const initFetch = async () => {
      if (mounted) {
        await fetchQueries();
        intervalId = setInterval(() => {
          if (mounted) {
            fetchQueries();
          }
        }, 30 * 60 * 1000);
      }
    };

    initFetch();

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchQueries]);

  const handleQueryClick = useCallback((query: string) => {
    navigate('/chat', { state: { initialQuery: query } });
  }, [navigate]);

  const getIcon = useCallback((iconName: string): React.ReactNode => {
    switch (iconName.toLowerCase()) {
      case 'trending-up':
        return <TrendingUp className="w-6 h-6 text-current" />;
      case 'tv':
        return <Tv className="w-6 h-6 text-current" />;
      case 'mountain':
        return <Mountain className="w-6 h-6 text-current" />;
      case 'thumbs-up':
        return <ThumbsUp className="w-6 h-6 text-current" />;
      case 'globe':
        return <Globe className="w-6 h-6 text-current" />;
      default:
        return <TrendingUp className="w-6 h-6 text-current" />;
    }
  }, []);

  const getColorClass = useCallback((color: string): string => {
    const colorMap: Record<string, string> = {
      blue: 'text-blue-500',
      purple: 'text-purple-500',
      green: 'text-green-500',
      yellow: 'text-yellow-500'
    };
    return colorMap[color] || 'text-blue-500';
  }, []);

  return (
    <div className="w-full max-w-3xl mt-6 px-4">
      {loading && (
        <div className="text-center mb-4">
          <div className="animate-pulse text-gray-400">Loading suggestions...</div>
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
};

export default SuggestedQueries;