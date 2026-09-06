import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Calendar } from 'lucide-react';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { JournalEntry, fetchOnThisDayEntries } from '../lib/db-services';
import { useAppStore } from '../store/useAppStore';

interface TimeMachineCardProps {
  userId: string;
}

export default function TimeMachineCard({ userId }: TimeMachineCardProps) {
  const { setActiveEntry, setEditorOpen } = useAppStore();
  const [memories, setMemories] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadMemories = async () => {
      try {
        const results = await fetchOnThisDayEntries(userId);
        if (isMounted) {
          setMemories(results);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load on-this-day memories:', err);
        if (isMounted) setLoading(false);
      }
    };
    loadMemories();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading || memories.length === 0) {
    return null; // Zero visual clutter when no past memory exists
  }

  const memory = memories[0];
  const memoryDate = memory.entryDate?.toDate ? memory.entryDate.toDate() : new Date(memory.entryDate);
  const now = new Date();
  const yearsDiff = differenceInYears(now, memoryDate);
  const monthsDiff = differenceInMonths(now, memoryDate);

  let timeAgoLabel = '1 Year Ago';
  if (yearsDiff > 1) {
    timeAgoLabel = `${yearsDiff} Years Ago`;
  } else if (yearsDiff === 1) {
    timeAgoLabel = '1 Year Ago';
  } else if (monthsDiff > 0) {
    timeAgoLabel = `${monthsDiff} Month${monthsDiff > 1 ? 's' : ''} Ago`;
  }

  return (
    <div className="mx-8 mb-8 border border-amber-200/60 bg-gradient-to-r from-amber-50/40 via-white to-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="p-1.5 bg-amber-100/80 rounded-lg text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              The Time Machine
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-medium text-gray-500">
              On This Day • {timeAgoLabel}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(memoryDate, 'MMMM d, yyyy')}
            </span>
          </div>

          {memory.title && (
            <h4 className="text-base font-semibold text-gray-900 mb-1">
              {memory.title}
            </h4>
          )}

          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 max-w-3xl">
            {memory.content}
          </p>

          {memory.tags && memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {memory.tags.map((tag) => (
                <span key={tag} className="text-[11px] bg-amber-50/80 text-amber-800 border border-amber-200/40 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setActiveEntry(memory);
            setEditorOpen(true);
          }}
          className="inline-flex items-center gap-2 self-start sm:self-center px-4 py-2 rounded-xl text-xs font-semibold text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-200/60 transition-colors shrink-0 cursor-pointer"
        >
          <span>Read Full Memory</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
