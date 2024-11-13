import React from 'react';
import { X, Facebook, Twitter, Share2, Link2 } from 'lucide-react';

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

Huduku AI - Powered by Asianxt
  `.trim();

  const encodedText = encodeURIComponent(shareText);

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}`
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=550,height=450');
  };

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
        
        <div className="bg-black rounded-lg p-4 mb-6">
          <pre className="text-gray-400 whitespace-pre-wrap text-sm">
            {shareText}
          </pre>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => handleShare('whatsapp')}
            className="flex flex-col items-center gap-2 p-4 bg-[#25D366] hover:bg-opacity-90 rounded-lg transition-colors"
          >
            <Share2 size={24} className="text-white" />
            <span className="text-white text-sm">WhatsApp</span>
          </button>

          <button
            onClick={() => handleShare('facebook')}
            className="flex flex-col items-center gap-2 p-4 bg-[#1877F2] hover:bg-opacity-90 rounded-lg transition-colors"
          >
            <Facebook size={24} className="text-white" />
            <span className="text-white text-sm">Facebook</span>
          </button>

          <button
            onClick={() => handleShare('twitter')}
            className="flex flex-col items-center gap-2 p-4 bg-black hover:bg-opacity-90 rounded-lg transition-colors"
          >
            <Twitter size={24} className="text-white" />
            <span className="text-white text-sm">X (Twitter)</span>
          </button>
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
            className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Link2 size={16} />
            <span>Copy Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;