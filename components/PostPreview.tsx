import React from 'react';
import { Platform, ProductInfo } from '../types';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2, Repeat, Image as ImageIcon } from 'lucide-react';

interface PostPreviewProps {
  platform: Platform;
  content: string;
  hashtags: string[];
  product: ProductInfo | null;
  suggestedImagePrompt?: string;
  generatedImageUrl?: string;
}

const PostPreview: React.FC<PostPreviewProps> = ({ platform, content, hashtags, product, suggestedImagePrompt, generatedImageUrl }) => {
  const fullContent = `${content}\n\n${hashtags.map(t => `${t}`).join(' ')}`;

  // Helper to render the media area
  const renderMedia = () => {
    // 1. Show Product Image if available
    if (product?.imageUrl) {
      return (
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=No+Image';
          }}
        />
      );
    }
    
    // 2. Show Generated AI Image if available
    if (generatedImageUrl) {
      return (
        <img 
          src={generatedImageUrl} 
          alt="AI Generated Content" 
          className="w-full h-full object-cover"
        />
      );
    }

    // 3. Fallback Placeholder
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-6 text-center text-gray-400">
        <ImageIcon className="w-8 h-8 mb-2" />
        <span className="text-xs uppercase tracking-widest font-bold">AI Image Concept</span>
        <p className="text-[10px] mt-2 italic opacity-70 line-clamp-3">{suggestedImagePrompt || "Waiting for content..."}</p>
      </div>
    );
  };

  // --- Instagram Preview ---
  if (platform === Platform.Instagram) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm max-w-sm mx-auto font-sans text-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center text-xs font-serif">
              eslite
            </div>
            <div>
              <div className="font-semibold text-xs text-gray-900">eslite_global</div>
              <div className="text-[10px] text-gray-500">誠品線上 Eslite Online</div>
            </div>
          </div>
          <MoreHorizontal className="w-4 h-4 text-gray-500" />
        </div>

        {/* Image */}
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {renderMedia()}
        </div>

        {/* Actions */}
        <div className="p-3">
          <div className="flex justify-between mb-2">
            <div className="flex gap-4">
              <Heart className="w-6 h-6 text-gray-800" />
              <MessageCircle className="w-6 h-6 text-gray-800" />
              <Send className="w-6 h-6 text-gray-800" />
            </div>
            <Bookmark className="w-6 h-6 text-gray-800" />
          </div>
          <div className="font-semibold text-sm mb-1">1,284 likes</div>
          <div className="text-sm">
            <span className="font-semibold mr-2">eslite_global</span>
            <span className="whitespace-pre-wrap text-gray-800">{fullContent}</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">2 HOURS AGO</div>
        </div>
      </div>
    );
  }

  // --- Facebook Preview ---
  if (platform === Platform.Facebook) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-w-sm mx-auto font-sans text-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center font-serif text-sm">
              E
            </div>
            <div>
              <div className="font-bold text-gray-900">誠品 eslite</div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                2h · <span className="text-[10px]">🌍</span>
              </div>
            </div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </div>

        {/* Content */}
        <div className="px-4 pb-3 text-sm text-gray-900 whitespace-pre-wrap">
          {fullContent}
        </div>

        {/* Image */}
        <div className="bg-gray-100 aspect-[1.91/1] overflow-hidden relative border-t border-b border-gray-100">
           {renderMedia()}
           {product && (
            <div className="absolute bottom-0 left-0 right-0 bg-gray-50 bg-opacity-95 backdrop-blur-sm p-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 uppercase">ESLITE.COM</div>
                <div className="font-bold text-gray-900 truncate">{product.name}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-2 flex justify-between text-gray-500">
           <div className="flex gap-2 items-center hover:bg-gray-50 px-4 py-1 rounded cursor-pointer">
              <ThumbsUp className="w-5 h-5" />
              <span className="font-medium">Like</span>
           </div>
           <div className="flex gap-2 items-center hover:bg-gray-50 px-4 py-1 rounded cursor-pointer">
              <MessageCircle className="w-5 h-5" />
              <span className="font-medium">Comment</span>
           </div>
           <div className="flex gap-2 items-center hover:bg-gray-50 px-4 py-1 rounded cursor-pointer">
              <Share2 className="w-5 h-5" />
              <span className="font-medium">Share</span>
           </div>
        </div>
      </div>
    );
  }

  // --- Threads Preview ---
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-w-sm mx-auto font-sans text-sm pt-4 pb-2">
      <div className="flex px-4 gap-3">
        {/* Avatar Column */}
        <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full bg-emerald-900 text-white flex items-center justify-center text-xs font-serif z-10">
              eslite
            </div>
            <div className="w-0.5 bg-gray-200 flex-grow mt-2 rounded-full min-h-[50px]"></div>
        </div>
        
        {/* Content Column */}
        <div className="flex-1 pb-4 border-b border-gray-100">
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-black text-sm">eslite_global</span>
                <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">2h</span>
                    <MoreHorizontal className="w-4 h-4 text-gray-800" />
                </div>
            </div>
            
            <div className="text-sm text-gray-900 whitespace-pre-wrap mb-3">
                {fullContent}
            </div>

             {/* Threads Image often smaller, rounded */}
             <div className="rounded-xl overflow-hidden border border-gray-100 mb-3 max-h-[300px]">
                {renderMedia()}
             </div>

            <div className="flex gap-4 text-gray-800 mt-2">
                <Heart className="w-5 h-5" />
                <MessageCircle className="w-5 h-5" />
                <Repeat className="w-5 h-5" />
                <Send className="w-5 h-5" />
            </div>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-200"></div>
           <span className="text-gray-400 text-sm">Reply to eslite_global...</span>
      </div>
    </div>
  );
};

export default PostPreview;
