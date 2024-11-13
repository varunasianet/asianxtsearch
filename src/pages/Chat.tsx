import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import SearchResult from '../components/SearchResult';

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

const floatingDotsAnimation = `
  @keyframes floating {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
    100% { transform: translateY(0px); }
  }
`;

const LoadingAnimation = () => (
  <div className="flex items-center gap-2 p-4">
    <style>{floatingDotsAnimation}</style>
    {[...Array(3)].map((_, i) => (
      <div
        key={i}
        className="w-3 h-3 rounded-full bg-white"
        style={{
          animation: 'floating 1s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`
        }}
      />
    ))}
  </div>
);

export default function Chat() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initialQuery = location.state?.initialQuery;
    if (initialQuery) {
      handleInitialQuery(initialQuery);
    }
  }, [location.state]);

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
        sources: response.citations
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
        sources: response.citations
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

  return (
    <div className="flex-1 flex flex-col h-screen bg-black">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                {message.type === 'user' ? (
                  'U'
                ) : (
                  <MessageSquare size={16} className="text-white" />
                )}
              </div>
              <div className="flex-1">
                {message.type === 'user' ? (
                  <div className="text-white whitespace-pre-wrap">
                    {message.content}
                  </div>
                ) : (
                  <SearchResult
                    content={message.content}
                    sources={message.sources}
                    query={messages[index - 1]?.content || ''}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                <MessageSquare size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="bg-zinc-900 rounded-lg p-2 inline-block">
                  <LoadingAnimation />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
  
      <div className="border-t border-zinc-800 p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a follow-up question..."
              className="w-full bg-zinc-900 text-white rounded-xl py-4 px-6 pr-24 outline-none focus:ring-2 focus:ring-white/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-black rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <span>{loading ? 'Thinking...' : 'Send'}</span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}