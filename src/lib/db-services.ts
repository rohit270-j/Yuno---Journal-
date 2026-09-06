import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, query, where, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import debounce from 'lodash.debounce';
import { format, subDays } from 'date-fns';

export interface UserStats {
  streakCount: number;
  totalEntries: number;
  lastEntryDate: any;
}

export interface JournalEntry {
  id?: string;
  userId: string;
  title?: string;
  content: string;
  audioUrl: string | null;
  images?: string[];
  context?: {
    city: string;
    weather: string;
    temp: string;
  };
  mood?: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  createdAt?: any; // Firestore Timestamp or Date
  entryDate: any; // Firestore Timestamp or Date
  lastUpdated?: any; // Firestore Timestamp or Date
}

/**
 * Robustly parses any entry date or timestamp into a valid JavaScript Date object.
 */
export const parseEntryDate = (val: any): Date => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * Calculates the current consecutive day journaling streak and whether an entry has been logged today.
 */
export const calculateUserStreak = (
  entries: JournalEntry[], 
  referenceDate: Date = new Date()
): { streakCount: number; hasJournaledToday: boolean } => {
  if (!entries || entries.length === 0) {
    return { streakCount: 0, hasJournaledToday: false };
  }

  // Collect unique calendar date strings (YYYY-MM-DD) in user's local timezone
  const uniqueDates = new Set<string>();
  for (const entry of entries) {
    const rawDate = entry.entryDate || entry.createdAt;
    if (!rawDate) continue;
    const d = parseEntryDate(rawDate);
    uniqueDates.add(format(d, 'yyyy-MM-dd'));
  }

  const todayStr = format(referenceDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(referenceDate, 1), 'yyyy-MM-dd');

  const hasJournaledToday = uniqueDates.has(todayStr);

  let streak = 0;
  let checkDate: Date;

  if (hasJournaledToday) {
    // Current streak includes today
    checkDate = referenceDate;
    while (uniqueDates.has(format(checkDate, 'yyyy-MM-dd'))) {
      streak++;
      checkDate = subDays(checkDate, 1);
    }
  } else if (uniqueDates.has(yesterdayStr)) {
    // Streak is active from yesterday (user hasn't written today yet)
    checkDate = subDays(referenceDate, 1);
    while (uniqueDates.has(format(checkDate, 'yyyy-MM-dd'))) {
      streak++;
      checkDate = subDays(checkDate, 1);
    }
  } else {
    // Neither today nor yesterday had an entry
    streak = 0;
  }

  return { streakCount: streak, hasJournaledToday };
};

/**
 * Calculates aggregate stats directly from entries list.
 */
export const calculateUserStats = (entries: JournalEntry[]): UserStats => {
  const { streakCount } = calculateUserStreak(entries);
  const totalEntries = entries.length;
  let lastEntryDate: any = null;

  if (entries.length > 0) {
    const newest = entries[0];
    lastEntryDate = newest.entryDate || newest.createdAt || null;
  }

  return {
    streakCount,
    totalEntries,
    lastEntryDate
  };
};

/**
 * Helper to get millisecond timestamp for sorting.
 */
const getEntryMillis = (item: JournalEntry): number => {
  const d = item.entryDate || item.createdAt;
  if (!d) return 0;
  if (typeof d.toMillis === 'function') return d.toMillis();
  if (typeof d.toDate === 'function') return d.toDate().getTime();
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'object' && typeof d.seconds === 'number') return d.seconds * 1000;
  const parsed = new Date(d).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Retrieves the user's journaling statistics from Firestore.
 */
export const getUserStats = async (userId: string): Promise<UserStats | null> => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserStats;
    }
  } catch (err) {
    console.error("Failed to get user stats:", err);
  }
  return null;
};

/**
 * Updates the user's journaling statistics (streak, total count, etc.).
 */
export const updateUserStats = async (userId: string, stats: Partial<UserStats>) => {
  try {
    const docRef = doc(db, 'users', userId);
    const cleanStats: any = {};
    if (stats.streakCount !== undefined) cleanStats.streakCount = stats.streakCount;
    if (stats.totalEntries !== undefined) cleanStats.totalEntries = stats.totalEntries;
    if (stats.lastEntryDate !== undefined) cleanStats.lastEntryDate = stats.lastEntryDate;

    await setDoc(docRef, cleanStats, { merge: true });
  } catch (err) {
    console.error("Failed to update user stats:", err);
  }
};

/**
 * Retrieves the user's journal entries sorted newest first.
 * Does not require a Firestore composite index to prevent query rejections.
 */
export const getRecentEntries = async (userId: string): Promise<JournalEntry[]> => {
  try {
    const q = query(
      collection(db, 'entries'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
    return entries.sort((a, b) => getEntryMillis(b) - getEntryMillis(a));
  } catch (err) {
    console.error("Failed to fetch entries:", err);
    return [];
  }
};

/**
 * Subscribes to real-time updates of the user's journal entries.
 */
export const subscribeToUserEntries = (
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      entries.sort((a, b) => getEntryMillis(b) - getEntryMillis(a));
      onUpdate(entries);
    },
    (err) => {
      console.error("Firestore onSnapshot error:", err);
      if (onError) onError(err);
    }
  );
};

/**
 * Searches entries by tag or text (basic implementation).
 */
export const searchEntries = async (userId: string, searchTerm: string): Promise<JournalEntry[]> => {
  // Note: Firestore doesn't support native full-text search easily.
  // This will pull recent ones and filter client-side for now to meet command palette needs.
  const entries = await getRecentEntries(userId);
  const lowerTerm = searchTerm.toLowerCase();
  
  return entries.filter(entry => 
    entry.content.toLowerCase().includes(lowerTerm) || 
    (entry.title && entry.title.toLowerCase().includes(lowerTerm)) ||
    entry.tags.some(tag => tag.toLowerCase().includes(lowerTerm)) ||
    (entry.context?.city && entry.context.city.toLowerCase().includes(lowerTerm))
  );
};

/**
 * Saves or updates a journal entry. 
 * If entry.id is present, it updates. Otherwise it creates.
 */
export const saveEntry = async (entry: JournalEntry): Promise<string> => {
  if (entry.id) {
    // Update existing entry
    const docRef = doc(db, 'entries', entry.id);
    const updateData: any = {
      title: entry.title,
      content: entry.content,
      audioUrl: entry.audioUrl,
      images: entry.images,
      context: entry.context ? entry.context : deleteField(),
      // If mood is undefined or null, explicitly remove the mood field from Firestore
      mood: entry.mood !== undefined ? entry.mood : deleteField(),
      tags: entry.tags,
      entryDate: entry.entryDate,
      lastUpdated: serverTimestamp()
    };
    
    // Clean undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(docRef, updateData);
    return entry.id;
  } else {
    // Create new entry
    const newDocRef = doc(collection(db, 'entries'));
    const entryData = {
      userId: entry.userId,
      title: entry.title,
      content: entry.content,
      audioUrl: entry.audioUrl,
      images: entry.images,
      context: entry.context,
      mood: entry.mood,
      tags: entry.tags,
      entryDate: entry.entryDate,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };
    
    // Clean undefined values
    Object.keys(entryData).forEach(key => {
      if (entryData[key as keyof typeof entryData] === undefined) {
        delete entryData[key as keyof typeof entryData];
      }
    });

    await setDoc(newDocRef, entryData);
    return newDocRef.id;
  }
};

/**
 * Permanently deletes a journal entry.
 */
export const deleteJournalEntry = async (entryId: string, userId?: string): Promise<void> => {
  const docRef = doc(db, 'entries', entryId);
  await deleteDoc(docRef);
  if (userId) {
    getRecentEntries(userId).then(entries => {
      const stats = calculateUserStats(entries);
      updateUserStats(userId, stats);
    }).catch((err) => {
      console.error("Failed to sync stats after delete:", err);
    });
  }
};

/**
 * Resurfaces entries written on this calendar day in previous months or years.
 */
export const fetchOnThisDayEntries = async (userId: string, targetDate: Date = new Date()): Promise<JournalEntry[]> => {
  const allEntries = await getRecentEntries(userId);
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();
  const currentYear = targetDate.getFullYear();

  return allEntries.filter(entry => {
    if (!entry.entryDate) return false;
    const entryDate = entry.entryDate.toDate ? entry.entryDate.toDate() : new Date(entry.entryDate);
    return (
      entryDate.getMonth() === targetMonth &&
      entryDate.getDate() === targetDay &&
      entryDate.getFullYear() < currentYear
    );
  });
};

/**
 * Debounced version of saveEntry to prevent excessive writes.
 * It waits 1500ms after the last call before executing.
 */
export const debouncedSaveEntry = debounce(async (
  entry: JournalEntry, 
  onSaveStart?: () => void,
  onSaveSuccess?: (id: string) => void,
  onSaveError?: (err: Error) => void
) => {
  if (onSaveStart) onSaveStart();
  try {
    const id = await saveEntry(entry);
    if (onSaveSuccess) onSaveSuccess(id);
  } catch (error: any) {
    console.error("Auto-save failed:", error);
    if (onSaveError) onSaveError(error);
  }
}, 1500);
