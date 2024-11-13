import React, { useState } from 'react';
import { Copy, Share, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import ShareModal from './ShareModal';

interface Source {
  number: number;
  url: string;
  title: string;
  text: string;
}

interface SearchResultProps {
  content: string;
  sources?: Source[];
  query: string;
}

export default function SearchResult({ content, sources = [], query }: SearchResultProps) {
  const [showAllSources, setShowAllSources] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const categorizedSources = sources.reduce((acc, source) => {
    const category = source.url.includes('asianetnews.com') ? 'asianet' : 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(source);
    return acc;
  }, {} as Record<string, Source[]>);

  const hasAsianetSources = categorizedSources.asianet?.length > 0;
  const sourcesPerCategory = hasAsianetSources ? 2 : 4;

  const getVisibleSources = (category: 'asianet' | 'other') => {
    const categorySources = categorizedSources[category] || [];
    return showAllSources ? categorySources : categorySources.slice(0, sourcesPerCategory);
  };

  const totalHiddenSources = sources.length - (hasAsianetSources ? 4 : sourcesPerCategory);
  const hasMoreSources = totalHiddenSources > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      alert('Content copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getWebsiteName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '').split('.')[0];
    } catch {
      return 'Website';
    }
  };

  const renderSourceGroup = (sources: Source[], title: string) => {
    if (!sources?.length) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-white text-sm font-medium">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sources.map((source, index) => (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-black rounded-lg p-3 hover:bg-zinc-800 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">
                  {getWebsiteName(source.url)}
                </span>
                <ExternalLink size={12} className="text-gray-400 group-hover:text-white" />
              </div>
              <p className="text-gray-400 text-sm mt-1 line-clamp-2">{source.text}</p>
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <p className="text-white whitespace-pre-wrap">{content}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Copy to clipboard"
          >
            <Copy size={20} />
          </button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Share"
          >
            <Share size={20} />
          </button>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="space-y-4">
          {hasAsianetSources ? (
            <>
              {renderSourceGroup(getVisibleSources('asianet'), 'Asianet Sources')}
              {renderSourceGroup(getVisibleSources('other'), 'Other Sources')}
            </>
          ) : (
            renderSourceGroup(getVisibleSources('other'), 'Sources')
          )}

          {hasMoreSources && (
            <button
              onClick={() => setShowAllSources(!showAllSources)}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm"
            >
              {showAllSources ? (
                <>
                  <ChevronUp size={16} />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span>Show {totalHiddenSources} more</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        query={query}
        answer={content}
      />
    </div>
  );
}