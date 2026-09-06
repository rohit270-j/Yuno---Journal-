import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Hash, Mic } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { searchEntries, JournalEntry } from '../lib/db-services';
import { format } from 'date-fns';

export default function CommandPalette({ userId }: { userId: string }) {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setEditorOpen, setActiveEntry } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JournalEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const fetchResults = async () => {
      const hits = await searchEntries(userId, query);
      setResults(hits);
      setSelectedIndex(0);
    };
    
    const timeoutId = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeoutId);
  }, [query, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return;

      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(results.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(results.length, 1));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        const selected = results[selectedIndex];
        setActiveEntry(selected);
        setCommandPaletteOpen(false);
        setEditorOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, results, selectedIndex, setCommandPaletteOpen, setActiveEntry, setEditorOpen]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-gray-900/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden mx-4 flex flex-col max-h-[70vh]">
        
        <div className="flex items-center px-6 py-4 border-b border-gray-100">
          <Search className="w-6 h-6 text-gray-400 mr-4 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search entries, tags, or reflections..."
            className="w-full text-xl bg-transparent border-none focus:ring-0 outline-none placeholder:text-gray-300 text-gray-900"
          />
          <kbd className="hidden sm:inline-block ml-4 px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500">ESC</kbd>
        </div>

        {results.length > 0 && (
          <div className="overflow-y-auto p-2">
            {results.map((entry, idx) => (
              <div
                key={entry.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  setActiveEntry(entry);
                  setCommandPaletteOpen(false);
                  setEditorOpen(true);
                }}
                className={`p-4 rounded-xl cursor-pointer flex flex-col gap-2 transition-colors ${
                  idx === selectedIndex ? 'bg-[#1A73E8]/5' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {entry.entryDate ? format(entry.entryDate.toDate(), 'MMM d, yyyy') : 'Recent'}
                  </div>
                  {entry.audioUrl && <Mic className="w-4 h-4 text-gray-400" />}
                </div>
                <p className="text-gray-900 line-clamp-2">
                  {/* Highlight match simply by rendering, advanced highlighting can be added later */}
                  {entry.content}
                </p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex gap-2 mt-1">
                    {entry.tags.map(tag => (
                      <span key={tag} className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Hash className="w-3 h-3 mr-0.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {query.trim() && results.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No results found for "{query}"
          </div>
        )}
        
        {!query.trim() && (
          <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
            <span>Start typing to search your journal entries and tags.</span>
            <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[11px]">Ctrl+R</kbd>
                Record today's journal
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-[11px]">ESC</kbd>
                Close
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
