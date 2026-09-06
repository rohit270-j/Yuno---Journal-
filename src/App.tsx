/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { signInWithGoogle } from './lib/firebase';
import Dashboard from './components/Dashboard';
import NavBar from './components/NavBar';
import CommandPalette from './components/CommandPalette';
import { useAppStore } from './store/useAppStore';
import { LogIn, Loader2, Sparkles } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const { isCommandPaletteOpen, setCommandPaletteOpen, startQuickRecord } = useAppStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ctrl + K or Cmd + K: Open command palette / search
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }

      // Ctrl + R or Cmd + R: Start recording journal for today
      if (e.key.toLowerCase() === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        startQuickRecord();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isCommandPaletteOpen, setCommandPaletteOpen, startQuickRecord]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E3E3E3] p-8 text-center transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[2px]">
          <div className="w-16 h-16 bg-[#1A73E8]/10 text-[#1A73E8] rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">AI Journal</h1>
          <p className="text-gray-600 leading-relaxed mb-8">Reflect on your day, brainstorm ideas, and converse with Gemini in your private, secure journal.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      <NavBar user={user} />
      <main className="max-w-[1400px] mx-auto">
        <Dashboard user={user} />
      </main>
      <CommandPalette userId={user.uid} />
    </div>
  );
}

