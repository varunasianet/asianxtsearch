import React from 'react';
import { X } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  answer: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, query, answer }) => {
  if (!isOpen) return null;

  const shareText = `
Question: ${query}

Answer: ${answer}

Powered by My Asianxt Search
  `.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      alert('Content copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-xl max-w-2xl w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-white text-xl font-medium mb-4">Share this result</h2>
        
        <div className="bg-black rounded-lg p-4 mb-4">
          <pre className="text-gray-400 whitespace-pre-wrap text-sm">
            {shareText}
          </pre>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;