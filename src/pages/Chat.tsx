import React, { useState, useEffect } from 'react';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';

interface Source {
  number: number;
  url: string;
  title: string;
  text: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export default function Chat() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialQuery = location.state?.initialQuery;
    if (initialQuery) {
      handleInitialQuery(initialQuery);
    }
  }, [location.state]);

  const formatSources = (citations: any[]) => {
    return citations.map((citation, index) => ({
      number: index + 1,
      url: citation.url,
      title: citation.title || `Source ${index + 1}`,
      text: citation.text || ''
    }));
  };

  const handleInitialQuery = async (query: string) => {
    try {
      setLoading(true);
      const response = await api.generate({ query });
      
      setConversationId(response.conversation_id);
      
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: query
      };

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.answer,
        sources: formatSources(response.citations)
      };

      setMessages([userMessage, aiMessage]);
    } catch (error) {
      console.error('Error handling initial query:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    try {
      setLoading(true);
      const response = await api.generate(
        { query: inputValue },
        conversationId
      );

      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: inputValue
      };

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.answer,
        sources: formatSources(response.citations)
      };

      setMessages([...messages, userMessage, aiMessage]);
      setInputValue('');
      setConversationId(response.conversation_id);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSources = (sources: Source[]) => {
    if (!sources || sources.length === 0) return null;

    return (
      <div className="mt-4 space-y-2">
        <h3 className="text-sm text-gray-400">Sources:</h3>
        <div className="grid grid-cols-2 gap-4">
          {sources.map((source, index) => (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#2D3135] rounded-lg p-4 hover:bg-[#363A3F] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1A1D21] flex items-center justify-center text-sm text-gray-400">
                  {source.number}
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">
                    {source.title}
                  </h4>
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {source.text}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#1A1D21]">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-3xl mx-auto ${
              message.type === 'user' ? 'text-white' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[#2D3135] flex items-center justify-center">
                {message.type === 'user' ? (
                  'U'
                ) : (
                  <MessageSquare size={16} className="text-cyan-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-white whitespace-pre-wrap">
                  {message.content}
                </div>
                {message.sources && renderSources(message.sources)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a follow-up question..."
              className="w-full bg-[#2D3135] text-white rounded-xl py-4 px-6 pr-24 outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#00A3A3] text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-[#00B3B3] transition-colors disabled:opacity-50"
            >
              <span>{loading ? 'Sending...' : 'Send'}</span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
