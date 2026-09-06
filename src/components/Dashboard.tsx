import React, { useEffect, useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Flame, Book, Sparkles, Mic, Plus, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { 
  getUserStats, 
  getRecentEntries, 
  deleteJournalEntry, 
  UserStats, 
  JournalEntry,
  subscribeToUserEntries,
  calculateUserStreak,
  updateUserStats,
  parseEntryDate
} from '../lib/db-services';
import { useAppStore } from '../store/useAppStore';
import { getDailySpark } from '../data/dailySparks';
import EditorModal from './EditorModal';
import TimeMachineCard from './TimeMachineCard';
import MoodHeatmap from './MoodHeatmap';
import WeeklyInsightCard from './WeeklyInsightCard';

export default function Dashboard({ user }: { user: User }) {
  const { isEditorOpen, setEditorOpen, setActiveEntry, startSparkReflection } = useAppStore();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const todaySpark = useMemo(() => getDailySpark(), []);

  // Dynamically calculate streak from real-time entries
  const streakStats = useMemo(() => {
    return calculateUserStreak(entries);
  }, [entries]);

  const totalCount = entries.length;

  // Real-time synchronization with Firestore entries
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (freshEntries) => {
        if (!isMounted) return;
        setEntries(freshEntries);
        setLoading(false);

        // Keep user document stats in sync with latest entries
        const streakInfo = calculateUserStreak(freshEntries);
        const newest = freshEntries[0];
        updateUserStats(user.uid, {
          streakCount: streakInfo.streakCount,
          totalEntries: freshEntries.length,
          lastEntryDate: newest ? (newest.entryDate || newest.createdAt || null) : null
        });
      },
      (err) => {
        console.error("Failed to subscribe to entries:", err);
        // Fallback to one-time fetch if subscription has an error
        getRecentEntries(user.uid).then(fallbackEntries => {
          if (!isMounted) return;
          setEntries(fallbackEntries);
          setLoading(false);
        });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user.uid]);

  const handleConfirmDelete = async () => {
    if (!entryToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteJournalEntry(entryToDelete.id, user.uid);
      setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
      setEntryToDelete(null);
    } catch (err) {
      console.error("Failed to delete entry:", err);
      alert("Unable to delete entry. Please check your connection.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Loading your journal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 mt-6">
        {/* Day Streak Metric */}
        <div className="bg-white border border-[#E3E3E3] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                  <Flame className="w-5 h-5 fill-amber-500/20 text-amber-500" />
                </div>
                <span className="text-gray-700 font-semibold text-sm">Day Streak</span>
              </div>
              {streakStats.hasJournaledToday && streakStats.streakCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[11px] font-medium">
                  <span>🔥</span> Active Today
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-50 text-gray-500 border border-gray-200/60 rounded-full text-[11px] font-medium">
                  {streakStats.streakCount > 0 ? 'Due Today' : 'Ready'}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold tracking-tight text-gray-900">
                {streakStats.streakCount}
              </span>
              <span className="text-sm font-medium text-gray-500">
                {streakStats.streakCount === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            {streakStats.hasJournaledToday
              ? "You've written today! Your streak is locked in."
              : streakStats.streakCount > 0
              ? "Reflect today to continue your streak."
              : "Write a journal entry to start your streak."}
          </p>
        </div>
        
        {/* Total Journals Metric */}
        <div className="bg-white border border-[#E3E3E3] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                  <Book className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-gray-700 font-semibold text-sm">Total Journals</span>
              </div>
              <span className="text-[11px] font-medium text-blue-600/80 bg-blue-50/70 px-2 py-0.5 rounded-full border border-blue-100">
                Lifetime
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-3xl font-bold tracking-tight text-gray-900">
                {totalCount}
              </span>
              <span className="text-sm font-medium text-gray-500">
                {totalCount === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            {totalCount > 0 
              ? "All thoughts and voice notes stored securely."
              : "No thoughts recorded yet. Start your first note!"}
          </p>
        </div>

        {/* The Daily Spark (Daily Thought) */}
        <div className="bg-[#FCFBF9] border border-amber-100/70 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600/80 flex items-center gap-1.5">
                <span>✦</span> Today's Spark
              </span>
              {todaySpark.theme && (
                <span className="text-[11px] text-amber-700/60 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/60">
                  {todaySpark.theme}
                </span>
              )}
            </div>
            <p className="font-serif text-lg text-gray-800 leading-snug mt-2">
              "{todaySpark.prompt}"
            </p>
          </div>
          <div className="flex justify-end mt-4 pt-1">
            <button
              type="button"
              onClick={() => startSparkReflection(todaySpark.prompt)}
              className="text-xs font-medium text-amber-800/90 hover:text-amber-950 bg-amber-100/50 hover:bg-amber-100/80 border border-amber-200/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Reflect on this prompt in your journal"
            >
              <span>Reflect on this (↵)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Synthesis Section */}
      <div className="mt-8 px-8 space-y-6">
        {/* The Quantified Mind (GitHub-style 365-day Mood Heatmap) */}
        <MoodHeatmap entries={entries} />

        {/* Weekly AI Life Coach Synthesis */}
        <WeeklyInsightCard entries={entries} userId={user.uid} />
      </div>

      {/* The Time Machine: On This Day (Conditional past memories) */}
      <div className="mt-8">
        <TimeMachineCard userId={user.uid} />
      </div>

      {/* Recent Entries */}
      <div className="px-8 flex items-center justify-between">
        <h2 className="text-xl font-medium tracking-tight text-gray-900">Recent Thoughts</h2>
        <button 
          onClick={() => { setActiveEntry(null); setEditorOpen(true); }}
          className="flex items-center gap-2 text-sm font-medium text-white bg-gray-900 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-8 mt-8">
          <div className="bg-white border border-[#E3E3E3] rounded-2xl p-12 flex flex-col items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="w-16 h-16 bg-[#1A73E8]/10 text-[#1A73E8] rounded-full flex items-center justify-center mb-4">
              <Book className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No entries yet</h3>
            <p className="text-gray-500 mb-6 text-center max-w-sm">
              Your journal is empty. Start recording your thoughts, ideas, or daily reflections.
            </p>
            <button 
              onClick={() => { setActiveEntry(null); setEditorOpen(true); }}
              className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Start your first journal
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 px-8 mt-4">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => { setActiveEntry(entry); setEditorOpen(true); }}
              className="group bg-white border border-[#E3E3E3] p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 ease-in-out hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] cursor-pointer flex flex-col h-full relative"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {format(parseEntryDate(entry.entryDate || entry.createdAt), 'MMMM d, yyyy')}
                  </span>
                  {entry.context && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100/80 text-gray-500 text-[11px] font-medium rounded-full border border-gray-200/50">
                        <span>📍</span>
                        <span>{entry.context.city}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100/80 text-gray-500 text-[11px] font-medium rounded-full border border-gray-200/50">
                        <span>⛅</span>
                        <span>{entry.context.temp} {entry.context.weather}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.mood && (
                    <span className="text-sm" title={`Mood: ${entry.mood}/5`}>
                      {entry.mood === 1 ? '😞' : entry.mood === 2 ? '😕' : entry.mood === 3 ? '😐' : entry.mood === 4 ? '🙂' : '✨'}
                    </span>
                  )}
                  {entry.audioUrl && <Mic className="w-4 h-4 text-gray-400" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEntryToDelete(entry);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {entry.title && (
                <h4 className="font-semibold text-gray-900 mb-1.5 text-base truncate">
                  {entry.title}
                </h4>
              )}
              <p className="text-gray-700 leading-relaxed line-clamp-3 mb-4 flex-1 text-sm">
                {entry.content}
              </p>
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-auto pt-4">
                  {entry.tags.map(tag => (
                    <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {entryToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100"
            >
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Delete Journal Entry?</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Are you sure you want to permanently delete this journal entry? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => setEntryToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isEditorOpen && <EditorModal user={user} onClose={() => { setActiveEntry(null); setEditorOpen(false); }} />}
    </div>
  );
}
