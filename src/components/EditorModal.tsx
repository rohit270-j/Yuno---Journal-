import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Cloud, Loader2, Calendar, Hash, CloudOff, MicOff, Check, Image as ImageIcon, Paperclip, Video, Bold, Italic, List, MapPin, Trash2 } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useGeolocation } from '../hooks/useGeolocation';
import { uploadImageToStorage } from '../lib/storage-services';
import { JournalEntry, saveEntry, deleteJournalEntry } from '../lib/db-services';
import MoodSelector, { MoodValue } from './MoodSelector';
import debounce from 'lodash.debounce';
import { useAppStore } from '../store/useAppStore';
import { getDailySpark } from '../data/dailySparks';
import { format } from 'date-fns';

interface EditorModalProps {
  user: User;
  onClose: () => void;
}

export default function EditorModal({ user, onClose }: EditorModalProps) {
  const { 
    activeEntry, 
    setActiveEntry, 
    autoStartRecording, 
    setAutoStartRecording,
    pendingSparkPrompt,
    setPendingSparkPrompt
  } = useAppStore();
  const [title, setTitle] = useState(activeEntry?.title || '');
  const [content, setContent] = useState(activeEntry?.content || '');
  const [tags, setTags] = useState<string[]>(activeEntry?.tags || []);
  const [images, setImages] = useState<string[]>(activeEntry?.images || []);
  const [mood, setMood] = useState<MoodValue | undefined>(activeEntry?.mood);
  const [tagInput, setTagInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { locationContext, fetchContext, clearLocation, setLocationContext } = useGeolocation();
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // If opening an existing entry, populate its saved context (or clear if none)
    if (activeEntry) {
      setLocationContext(activeEntry.context || null);
    } else {
      // If creating a brand new entry, fetch current location context
      setLocationContext(null);
      fetchContext();
    }
  }, [activeEntry]);
  const [entryDate, setEntryDate] = useState(
    activeEntry?.entryDate?.toDate 
      ? activeEntry.entryDate.toDate().toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
  );
  const [entryId, setEntryId] = useState<string | null>(activeEntry?.id || null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [interimText, setInterimText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const todaySpark = useMemo(() => {
    const d = entryDate ? new Date(entryDate + 'T00:00:00') : new Date();
    return getDailySpark(d);
  }, [entryDate]);

  const handleReflectOnSpark = useCallback(() => {
    const blockquote = `> "${todaySpark.prompt}"\n\n`;
    setContent(prev => {
      if (!prev || prev.trim() === '') {
        return blockquote;
      }
      if (!prev.includes(todaySpark.prompt)) {
        return `${blockquote}${prev}`;
      }
      return prev;
    });

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPosition = blockquote.length;
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 50);
  }, [todaySpark.prompt]);

  // Handle pending spark reflection from dashboard
  useEffect(() => {
    if (pendingSparkPrompt) {
      const promptToInsert = pendingSparkPrompt;
      const blockquote = `> "${promptToInsert}"\n\n`;
      setContent(prev => {
        if (!prev || prev.trim() === '') {
          return blockquote;
        }
        if (!prev.includes(promptToInsert)) {
          return `${blockquote}${prev}`;
        }
        return prev;
      });
      setPendingSparkPrompt(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const cursorPosition = blockquote.length;
          textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 80);
    }
  }, [pendingSparkPrompt, setPendingSparkPrompt]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const handleClose = () => {
    setActiveEntry(null);
    onClose();
  };

  const handleDeleteEntry = async () => {
    const targetId = entryIdRef.current || entryId || activeEntry?.id;
    if (!targetId) return;
    setIsDeleting(true);
    try {
      debouncedSave.cancel();
      await deleteJournalEntry(targetId);
      setActiveEntry(null);
      onClose();
    } catch (err) {
      console.error("Failed to delete entry:", err);
      alert("Unable to delete entry. Please check your connection.");
      setIsDeleting(false);
    }
  };

  const entryIdRef = useRef<string | null>(null);
  useEffect(() => {
    entryIdRef.current = entryId;
  }, [entryId]);

  const debouncedSave = useRef(
    debounce(async (
      entryData: JournalEntry, 
      onStart: () => void, 
      onSuccess: (id: string) => void, 
      onError: () => void
    ) => {
      onStart();
      try {
        const id = await saveEntry(entryData);
        onSuccess(id);
      } catch (e) {
        console.error("Save error:", e);
        onError();
      }
    }, 1500)
  ).current;

  // Auto-save effect
  useEffect(() => {
    if (!title.trim() && !content.trim() && tags.length === 0 && images.length === 0) return;
    
    const entryData: JournalEntry = {
      id: entryIdRef.current || undefined,
      userId: user.uid,
      title,
      content,
      tags,
      images,
      mood,
      context: locationContext || undefined,
      audioUrl: null,
      entryDate: new Date(entryDate)
    };

    debouncedSave(
      entryData, 
      () => setSaveState('saving'), 
      (id) => {
        setSaveState('saved');
        if (!entryIdRef.current) setEntryId(id);
      }, 
      () => setSaveState('error')
    );
  }, [title, content, tags, images, mood, locationContext, entryDate, debouncedSave, user.uid]);

  const handleSpeechResult = React.useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setContent(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + text + ' ');
      setInterimText('');
    } else {
      setInterimText(text);
    }
  }, []);

  const { supported, isListening, toggleListening, startListening, error: speechError } = useSpeechRecognition(handleSpeechResult);

  // Auto-start recording when requested (e.g. via dashboard Mic button or Ctrl+R)
  useEffect(() => {
    if (autoStartRecording && supported) {
      const timer = setTimeout(() => {
        startListening();
        setAutoStartRecording(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoStartRecording, supported, startListening, setAutoStartRecording]);

  // Allow toggling speech recording with Ctrl + R (or Cmd + R) while inside editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        e.stopPropagation();
        toggleListening();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [toggleListening]);

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, '');
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const localUrl = URL.createObjectURL(file);
    setImages(prev => [...prev, localUrl]);
    try {
      const downloadUrl = await uploadImageToStorage(file, user.uid, entryIdRef.current || 'temp');
      setImages(prev => prev.map(img => img === localUrl ? downloadUrl : img));
    } catch (error) {
      console.error("Failed to upload image:", error);
      setImages(prev => prev.filter(img => img !== localUrl));
    }
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  }, [user.uid]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto backdrop-blur-sm bg-white/95"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="max-w-4xl w-full mx-auto pt-16 sm:pt-20 px-4 sm:px-8 pb-48 relative min-h-screen flex flex-col">
        
        {/* Header Details with Proper Dynamic Spacing */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 pt-2">
          {/* Metadata & Context Group */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
            {/* Date Picker Pill */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-200/80 shadow-xs whitespace-nowrap shrink-0 hover:border-gray-300 transition-colors">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
              <input 
                type="date" 
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-xs sm:text-sm font-medium text-gray-700 outline-none cursor-pointer"
              />
            </div>
            
            {/* Category / Primary Tag Pill */}
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-200/80 shadow-xs whitespace-nowrap shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
              <span className="font-medium">{tags.length > 0 ? tags[0] : 'Reflection'}</span>
            </div>

            {/* Context Engine Location & Weather Pills */}
            {locationContext && (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100/80 text-gray-600 text-xs font-medium rounded-full border border-gray-200/60 whitespace-nowrap shrink-0 shadow-xs">
                  <span className="text-xs leading-none">📍</span>
                  <span>{locationContext.city}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100/80 text-gray-600 text-xs font-medium rounded-full border border-gray-200/60 whitespace-nowrap shrink-0 shadow-xs">
                  <span className="text-xs leading-none">⛅</span>
                  <span>{locationContext.temp} {locationContext.weather}</span>
                  <button 
                    type="button"
                    onClick={clearLocation} 
                    className="ml-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded-full p-0.5 hover:bg-gray-200"
                    title="Remove location"
                    aria-label="Remove location"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </>
            )}
          </div>
          
          {/* Action & Status Controls Group */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0">
            {/* Word Count Pill */}
            <div className="text-xs font-medium text-gray-400 whitespace-nowrap flex items-center gap-1">
              <span className="hidden sm:inline">WORD COUNT:</span>
              <span className="text-gray-800 bg-white px-2 py-1 rounded-md border border-gray-200/80 shadow-xs font-mono">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Auto-Save Indicator */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs transition-all whitespace-nowrap shrink-0 ${
                saveState === 'saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                saveState === 'saving' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                saveState === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                'bg-white border-gray-200/80 text-gray-500'
              }`}>
                {saveState === 'idle' && <span className="text-xs font-medium">Ready</span>}
                {saveState === 'saving' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span className="text-xs font-medium">Saving...</span>
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-medium">Saved</span>
                  </>
                )}
                {saveState === 'error' && (
                  <>
                    <X className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium">Error saving</span>
                  </>
                )}
              </div>

              {/* Delete Entry Button */}
              {(entryIdRef.current || entryId || activeEntry?.id) && (
                <button 
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)} 
                  disabled={isDeleting}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-rose-600 bg-white hover:bg-rose-50 border border-gray-200/80 hover:border-rose-200 shadow-xs rounded-full transition-colors outline-none cursor-pointer"
                  title="Delete Entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Close Button */}
              <button 
                type="button"
                onClick={handleClose} 
                className="p-1.5 sm:p-2 text-gray-500 bg-white hover:bg-gray-100 border border-gray-200/80 shadow-xs rounded-full transition-colors outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer"
                title="Close editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Tag Input Section */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              #{tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1.5 text-gray-400 focus-within:text-[#1A73E8] transition-colors bg-white px-3 py-1 rounded-full border border-transparent hover:border-[#E3E3E3]">
            <Hash className="w-4 h-4" />
            <input 
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInput}
              placeholder="Add tags..."
              className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-gray-900 outline-none w-24 placeholder:text-gray-400 placeholder:font-normal"
            />
          </div>
        </div>

        {/* The Daily Spark (Quiet, inspiring prompt card) */}
        <div className="bg-[#FCFBF9] border border-amber-100/70 rounded-2xl p-5 mb-8">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600/80">
              ✦ Today's Spark
            </span>
            {todaySpark.theme && (
              <span className="text-[11px] text-amber-700/60 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/40">
                {todaySpark.theme}
              </span>
            )}
          </div>
          <p className="font-serif text-lg text-gray-800 leading-snug mt-1">
            "{todaySpark.prompt}"
          </p>
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={handleReflectOnSpark}
              className="text-xs font-medium text-amber-800/90 hover:text-amber-950 bg-amber-100/50 hover:bg-amber-100/80 border border-amber-200/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>Reflect on this (↵)</span>
            </button>
          </div>
        </div>

        {/* The Text Editor */}
        <div className="flex-1 relative flex flex-col">
          <AnimatePresence>
            {isDragging && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 backdrop-blur-sm border-2 border-dashed border-blue-400 bg-blue-50/40 rounded-2xl flex items-center justify-center pointer-events-none"
              >
                <div className="bg-white px-6 py-3 rounded-full shadow-sm border border-blue-100 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                  <span className="text-blue-600 font-medium">Drop image to embed</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {content.length === 0 && !title && !isListening && images.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center -mt-20 z-0">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-300 mb-2">What's on your mind?</h2>
              <p className="text-gray-400">Speak, type, or drag an image...</p>
            </div>
          )}
          
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Heading..."
            className="w-full text-3xl md:text-4xl font-bold tracking-tight text-gray-900 bg-transparent border-none focus:ring-0 px-0 outline-none placeholder:text-gray-300 mb-4 z-10"
          />

          {/* Render Images */}
          {images.length > 0 && (
            <div className="flex flex-col gap-4 mb-4 z-10">
              {images.map((img, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-100 shadow-sm max-w-full inline-block self-start">
                  <img src={img} alt="Attached" className="max-h-96 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
                    <button 
                      onClick={() => setImages(images.filter((_, i) => i !== idx))}
                      className="p-1.5 bg-white/20 hover:bg-red-500 text-white rounded-full transition-colors backdrop-blur-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder=""
            className="w-full text-lg md:text-xl leading-relaxed text-gray-800 bg-transparent border-none focus:ring-0 resize-none min-h-[50vh] outline-none z-10"
          />
        </div>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        {/* Toolbar UI */}
        <div className={`fixed transition-all duration-500 ease-in-out z-40 flex items-center justify-center ${
          content.length === 0 && !title ? 'bottom-[30%] left-1/2 -translate-x-1/2' : 'bottom-8 left-1/2 -translate-x-1/2'
        }`}>
          <div className="flex flex-col items-center gap-2.5">
            {/* 5-Point Discrete Mood Selector */}
            <MoodSelector value={mood} onChange={setMood} />

            {speechError && (
              <div className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-full border border-red-100 shadow-sm whitespace-nowrap">
                {speechError}
              </div>
            )}
            
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1.5 rounded-full border border-[#E3E3E3] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
              {/* Text Formatting Group */}
              <div className="flex items-center hidden sm:flex">
                <button className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" title="Bold">
                  <Bold className="w-4 h-4" />
                </button>
                <button className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" title="Italic">
                  <Italic className="w-4 h-4" />
                </button>
                <button className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" title="Bullet List">
                  <List className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>

              {/* Attachments Group */}
              <div className="flex items-center">
                <button 
                  className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" 
                  title="Upload Image"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button 
                  className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" 
                  title="Upload Video"
                  onClick={() => alert("Video uploading requires a Firebase Storage video bucket.")}
                >
                  <Video className="w-4 h-4" />
                </button>
                <button 
                  className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" 
                  title="Attach File"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-200 mx-2"></div>

              {/* Mic Button */}
              {supported ? (
                <div className={`flex items-center ${isListening ? 'pr-4 bg-[#1A73E8]/5 rounded-full transition-all' : ''}`}>
                  <motion.button
                    onClick={toggleListening}
                    title={isListening ? "Stop recording (Ctrl + R)" : "Start voice recording (Ctrl + R)"}
                    aria-label={isListening ? "Stop recording (Ctrl + R)" : "Start voice recording (Ctrl + R)"}
                    animate={isListening ? { 
                      scale: [1, 1.1, 1], 
                      boxShadow: [
                        "0px 0px 0px 0px rgba(26,115,232,0.4)", 
                        "0px 0px 0px 15px rgba(26,115,232,0)", 
                        "0px 0px 0px 0px rgba(26,115,232,0)"
                      ] 
                    } : { 
                      scale: 1, 
                      boxShadow: "0px 0px 0px 0px rgba(26,115,232,0)" 
                    }}
                    transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
                    className={`p-3 rounded-full flex items-center justify-center outline-none ${
                      isListening ? 'bg-[#1A73E8] text-white shadow-lg' : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    <Mic className="w-5 h-5" />
                  </motion.button>
                  
                  {isListening && (
                    <div className="flex flex-col max-w-[120px] overflow-hidden justify-center min-w-[100px] ml-3">
                      <span className="text-[10px] font-bold text-[#1A73E8] uppercase tracking-widest mb-0.5">Listening...</span>
                      <span className="text-sm text-gray-700 truncate font-medium">
                        {interimText || 'Speak...'}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-50 text-gray-500 px-4 py-2 rounded-full text-sm">
                  <MicOff className="w-4 h-4" />
                  No Mic
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AnimatePresence>
          {showDeleteConfirm && (
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
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEntry}
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
      </div>
    </div>
  );
}
