import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import debounce from 'lodash.debounce';

export interface UserStats {
  streakCount: number;
  totalEntries: number;
  lastEntryDate: any; // Firestore Timestamp
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
  createdAt?: any; // Firestore Timestamp
  entryDate: any; // Firestore Timestamp
  lastUpdated?: any; // Firestore Timestamp
}

/**
 * Retrieves the user's journaling statistics.
 */
export const getUserStats = async (userId: string): Promise<UserStats | null> => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserStats;
  }
  return null;
};

/**
 * Updates the user's journaling statistics (streak, etc.).
 */
export const updateUserStats = async (userId: string, stats: Partial<UserStats>) => {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, stats, { merge: true });
};

/**
 * Retrieves the user's most recent journal entries.
 */
export const getRecentEntries = async (userId: string): Promise<JournalEntry[]> => {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
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
export const deleteJournalEntry = async (entryId: string): Promise<void> => {
  const docRef = doc(db, 'entries', entryId);
  await deleteDoc(docRef);
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
