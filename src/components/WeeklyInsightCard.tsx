import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, RefreshCw, Compass, CheckCircle2, ArrowRight } from 'lucide-react';
import { JournalEntry, parseEntryDate } from '../lib/db-services';
import { format, subDays, isAfter } from 'date-fns';

interface WeeklyInsightCardProps {
  entries: JournalEntry[];
  userId: string;
}

interface WeeklyInsightData {
  keyThemes: string[];
  reflection: string;
  takeaway: string;
  generatedAt?: string;
}

export default function WeeklyInsightCard({ entries, userId }: WeeklyInsightCardProps) {
  const [insight, setInsight] = useState<WeeklyInsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter entries from the last 7 days
  const recentWeekEntries = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return entries.filter((entry) => {
      const rawDate = entry.entryDate || entry.createdAt;
      if (!rawDate) return false;
      const d = parseEntryDate(rawDate);
      return isAfter(d, sevenDaysAgo);
    });
  }, [entries]);

  // Check local cache for the user's weekly insight
  useEffect(() => {
    const cacheKey = `weekly_insight_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setInsight(parsed);
      } catch {
        // Cache miss or corrupted
      }
    }
  }, [userId]);

  const generateInsight = async () => {
    if (recentWeekEntries.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payloadEntries = recentWeekEntries.map((e) => {
        const d = parseEntryDate(e.entryDate || e.createdAt);
        return {
          date: format(d, 'yyyy-MM-dd'),
          title: e.title || '',
          content: e.content,
          mood: e.mood,
          tags: e.tags,
        };
      });

      const response = await fetch('/api/weekly-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: payloadEntries }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate weekly insight.');
      }

      const data: WeeklyInsightData = await response.json();
      data.generatedAt = new Date().toISOString();
      setInsight(data);

      const cacheKey = `weekly_insight_${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (err: any) {
      console.error('Error generating weekly synthesis:', err);
      setError(err.message || 'Unable to generate synthesis at this time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-purple-50/20 shadow-sm rounded-2xl p-6 transition-all duration-200 hover:shadow-md relative overflow-hidden">
      {/* Decorative ambient blur */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs">
            <span>✦</span>
            <span>Weekly Synthesis</span>
          </span>
          <span className="text-xs text-gray-400">
            {recentWeekEntries.length} {recentWeekEntries.length === 1 ? 'entry' : 'entries'} this week
          </span>
        </div>

        <button
          onClick={generateInsight}
          disabled={loading || recentWeekEntries.length === 0}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-medium text-indigo-700 bg-indigo-100/70 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-full border border-indigo-200/60 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Synthesizing...' : insight ? 'Regenerate Brief' : 'Generate Weekly Brief'}</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
          {error}
        </div>
      )}

      {/* Body Content */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
          <p className="text-sm font-medium text-indigo-900">Consulting your cognitive-behavioral coach...</p>
          <p className="text-xs text-gray-500 mt-1">Analyzing primary themes, mood patterns, and takeaways.</p>
        </div>
      ) : insight ? (
        <div className="space-y-4">
          {/* Key Themes */}
          {insight.keyThemes && insight.keyThemes.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Key Themes
              </div>
              <div className="flex flex-wrap gap-2">
                {insight.keyThemes.map((theme, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 text-indigo-900 border border-indigo-100 shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>{theme}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* The Reflection */}
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              The Reflection
            </div>
            <p className="text-sm text-gray-700 leading-relaxed max-w-3xl">
              {insight.reflection}
            </p>
          </div>

          {/* Actionable Takeaway */}
          {insight.takeaway && (
            <div className="pt-2 border-t border-indigo-100/60 flex items-start gap-2.5">
              <Compass className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-indigo-950">Actionable Takeaway: </span>
                <span className="text-xs text-gray-600">{insight.takeaway}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100/60 text-indigo-600 rounded-xl mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                {recentWeekEntries.length > 0
                  ? 'Your weekly reflections are ready for synthesis'
                  : 'Start journaling to unlock your weekly brief'}
              </h4>
              <p className="text-xs text-gray-500 mt-1 max-w-xl">
                {recentWeekEntries.length > 0
                  ? 'Click "Generate Weekly Brief" to synthesize your thoughts, identify emotional trends, and get an empathetic cognitive-behavioral coach breakdown.'
                  : 'Once you record reflections this week, our AI Life Coach will summarize key themes, emotional patterns, and an actionable takeaway.'}
              </p>
            </div>
          </div>

          {recentWeekEntries.length > 0 && (
            <button
              onClick={generateInsight}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <span>Synthesize Week</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
