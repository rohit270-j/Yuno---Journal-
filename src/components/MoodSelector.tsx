import React from 'react';

export type MoodValue = 1 | 2 | 3 | 4 | 5;

interface MoodSelectorProps {
  value: MoodValue | undefined;
  onChange: (mood: MoodValue | undefined) => void;
}

const MOODS: { value: MoodValue; emoji: string; label: string; activeClass: string }[] = [
  { value: 1, emoji: '😞', label: 'Heavy', activeClass: 'bg-rose-100 text-rose-800 border-rose-300 shadow-sm' },
  { value: 2, emoji: '😕', label: 'Low', activeClass: 'bg-orange-100 text-orange-800 border-orange-300 shadow-sm' },
  { value: 3, emoji: '😐', label: 'Neutral', activeClass: 'bg-gray-200 text-gray-800 border-gray-400 shadow-sm' },
  { value: 4, emoji: '🙂', label: 'Good', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm' },
  { value: 5, emoji: '✨', label: 'Radiant', activeClass: 'bg-emerald-200 text-emerald-900 border-emerald-400 shadow-sm' },
];

export default function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md rounded-full border border-[#E3E3E3] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider px-2 hidden sm:inline">
        Mood
      </span>
      {MOODS.map((m) => {
        const isSelected = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              if (isSelected) {
                onChange(undefined);
              } else {
                onChange(m.value);
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
              isSelected
                ? m.activeClass
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={isSelected ? `Click to unselect (${m.label})` : `${m.emoji} ${m.label}`}
          >
            <span className="text-sm leading-none">{m.emoji}</span>
            <span className="text-xs">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
