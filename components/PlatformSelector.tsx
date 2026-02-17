import React from 'react';
import { Platform } from '../types';
import { Instagram, Facebook, MessageCircle } from 'lucide-react';

interface PlatformSelectorProps {
  selected: Platform;
  onChange: (p: Platform) => void;
}

const PlatformSelector: React.FC<PlatformSelectorProps> = ({ selected, onChange }) => {
  const platforms = [
    { id: Platform.Instagram, icon: Instagram, color: 'hover:text-pink-600', active: 'bg-pink-50 text-pink-600 border-pink-200' },
    { id: Platform.Facebook, icon: Facebook, color: 'hover:text-blue-600', active: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: Platform.Threads, icon: MessageCircle, color: 'hover:text-black', active: 'bg-gray-100 text-black border-gray-300' },
  ];

  return (
    <div className="flex space-x-2 w-full">
      {platforms.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all duration-200
            ${selected === p.id 
              ? `${p.active} shadow-sm border` 
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}
          `}
        >
          <p.icon className="w-5 h-5" />
          <span className="font-medium text-sm">{p.id}</span>
        </button>
      ))}
    </div>
  );
};

export default PlatformSelector;
