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
import SignIn from './components/SignIn';
import { useAppStore } from './store/useAppStore';
import { Loader2 } from 'lucide-react';

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
    return <SignIn onSignIn={signInWithGoogle} />;
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

