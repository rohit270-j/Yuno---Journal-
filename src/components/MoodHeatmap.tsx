import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../lib/db-services';
import { format, subDays, startOfWeek, addDays, isSameDay } from 'date-fns';
import { useAppStore } from '../store/useAppStore';

interface MoodHeatmapProps {
  entries: JournalEntry[];
}

const MOOD_CONFIG: Record<number, { label: string; emoji: string; bgClass: string; hex: string }> = {
  1: { label: 'Heavy', emoji: '😞', bgClass: 'bg-rose-200 hover:bg-rose-300', hex: '#FECDD3' },
  2: { label: 'Low', emoji: '😕', bgClass: 'bg-orange-200 hover:bg-orange-300', hex: '#FED7AA' },
  3: { label: 'Neutral', emoji: '😐', bgClass: 'bg-gray-300 hover:bg-gray-400', hex: '#D1D5DB' },
  4: { label: 'Good', emoji: '🙂', bgClass: 'bg-emerald-200 hover:bg-emerald-300', hex: '#A7F3D0' },
  5: { label: 'Radiant', emoji: '✨', bgClass: 'bg-emerald-400 hover:bg-emerald-500', hex: '#34D399' },
};

interface DayCell {
  date: Date;
  dateStr: string;
  entry?: JournalEntry;
  mood?: 1 | 2 | 3 | 4 | 5;
}

export default function MoodHeatmap({ entries }: MoodHeatmapProps) {
  const { setActiveEntry, setEditorOpen } = useAppStore();
  const [hoveredCell, setHoveredCell] = useState<{ cell: DayCell; x: number; y: number } | null>(null);

  // Map entries by date string YYYY-MM-DD
  const entryDateMap = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    entries.forEach((e) => {
      if (!e.entryDate) return;
      const d = e.entryDate.toDate ? e.entryDate.toDate() : new Date(e.entryDate);
      const key = format(d, 'yyyy-MM-dd');
      // If multiple, pick the one with mood or most recent
      if (!map.has(key) || (!map.get(key)?.mood && e.mood)) {
        map.set(key, e);
      }
    });
    return map;
  }, [entries]);

  // Compute 52 columns of 7 days ending at today's week
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    // 52 weeks ago from start of week
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const startOfGrid = subDays(startOfCurrentWeek, 51 * 7);

    const calculatedWeeks: DayCell[][] = [];
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < 52; w++) {
      const weekDays: DayCell[] = [];
      const weekStart = addDays(startOfGrid, w * 7);

      for (let d = 0; d < 7; d++) {
        const currentDate = addDays(weekStart, d);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const entry = entryDateMap.get(dateStr);
        weekDays.push({
          date: currentDate,
          dateStr,
          entry,
          mood: entry?.mood,
        });

        // Detect month transitions across any day within the week
        const m = currentDate.getMonth();
        if (lastMonth === -1) {
          months.push({ label: format(currentDate, 'MMM'), colIndex: w });
          lastMonth = m;
        } else if (m !== lastMonth) {
          months.push({ label: format(currentDate, 'MMM'), colIndex: w });
          lastMonth = m;
        }
      }
      calculatedWeeks.push(weekDays);
    }

    return { weeks: calculatedWeeks, monthLabels: months };
  }, [entryDateMap]);

  return (
    <div className="bg-white border border-[#E3E3E3] p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 tracking-tight">The Quantified Mind</h3>
          <p className="text-xs text-gray-500 mt-0.5">365-day consistency & emotional well-being timeline</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="text-[11px] text-gray-400 mr-1">Mood:</span>
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200" title="No Entry"></span>
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-200" title="Heavy"></span>
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-200" title="Low"></span>
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" title="Neutral"></span>
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200" title="Good"></span>
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" title="Radiant"></span>
          <span className="text-[11px] text-gray-400 ml-1">Radiant</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          {/* Month Labels Header Row */}
          <div className="flex gap-2 mb-1.5">
            {/* Spacer matching the width of the Weekday column */}
            <div className="w-7 shrink-0" aria-hidden="true" />

            {/* Month labels container, spans 100% of the 52-column grid */}
            <div className="relative flex-1 h-4 select-none">
              {monthLabels.map((m, idx) => {
                const isLast = idx === monthLabels.length - 1;
                const isFirst = idx === 0;
                const leftPercent = (m.colIndex / 52) * 100;
                return (
                  <span
                    key={`${m.label}-${m.colIndex}`}
                    style={
                      isLast
                        ? { right: 0 }
                        : isFirst
                        ? { left: 0 }
                        : { left: `${leftPercent}%` }
                    }
                    className="absolute top-0 text-[11px] font-medium text-gray-400 whitespace-nowrap"
                  >
                    {m.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Grid with Day Labels */}
          <div className="flex gap-2 items-stretch">
            {/* Weekday indicators: Mon, Tue, Wed, Thu, Fri, Sat, Sun */}
            <div 
              className="grid gap-1 w-7 shrink-0 select-none text-[9px] text-gray-400 font-medium"
              style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
            >
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="flex items-center leading-none">
                  {day}
                </div>
              ))}
            </div>

            {/* 52 Columns */}
            <div className="flex gap-1 flex-1">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-1 flex-1">
                  {week.map((cell) => {
                    let cellBg = 'bg-gray-100 hover:ring-1 hover:ring-gray-300';
                    if (cell.mood && MOOD_CONFIG[cell.mood]) {
                      cellBg = MOOD_CONFIG[cell.mood].bgClass;
                    } else if (cell.entry) {
                      cellBg = 'bg-blue-100 hover:bg-blue-200';
                    }

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => {
                          if (cell.entry) {
                            setActiveEntry(cell.entry);
                            setEditorOpen(true);
                          }
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            cell,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`aspect-square w-full rounded-sm transition-colors cursor-pointer ${cellBg}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: hoveredCell.x,
            top: hoveredCell.y - 8,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
          }}
          className="z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-800 max-w-xs whitespace-normal"
        >
          <div className="font-semibold flex items-center justify-between gap-3 text-gray-200">
            <span>{format(hoveredCell.cell.date, 'EEEE, MMM d, yyyy')}</span>
            {hoveredCell.cell.mood && MOOD_CONFIG[hoveredCell.cell.mood] && (
              <span className="text-xs">
                {MOOD_CONFIG[hoveredCell.cell.mood].emoji} {MOOD_CONFIG[hoveredCell.cell.mood].label}
              </span>
            )}
          </div>
          {hoveredCell.cell.entry ? (
            <div className="mt-1 text-gray-300 text-[11px] leading-relaxed">
              {hoveredCell.cell.entry.title && (
                <div className="font-medium text-white truncate">{hoveredCell.cell.entry.title}</div>
              )}
              <div className="line-clamp-2">{hoveredCell.cell.entry.content}</div>
              <div className="text-[10px] text-blue-300 mt-1">Click to view memory →</div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 mt-0.5">No journal entry recorded</div>
          )}
        </div>
      )}
    </div>
  );
}
