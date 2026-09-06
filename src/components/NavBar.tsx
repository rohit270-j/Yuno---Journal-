import React from 'react';
import { User } from 'firebase/auth';
import { Search, Mic } from 'lucide-react';
import { logOut } from '../lib/firebase';
import { useAppStore } from '../store/useAppStore';

interface NavBarProps {
  user: User;
}

export default function NavBar({ user }: NavBarProps) {
  const { setCommandPaletteOpen, startQuickRecord } = useAppStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };
  
  const firstName = user.displayName?.split(' ')[0] || 'there';

  return (
    <nav className="h-16 flex items-center justify-between px-8 bg-[#F8F9FA] sticky top-0 z-10">
      <h1 className="text-gray-900 font-medium tracking-tight text-lg">
        {getGreeting()}, {firstName}
      </h1>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E3E3E3] rounded-lg text-sm text-gray-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
            onClick={() => setCommandPaletteOpen(true)}
            title="Search entries (⌘K / Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
            <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">⌘K</kbd>
          </button>

          {/* Quick Voice Record Button beside Search Bar */}
          <button
            type="button"
            onClick={startQuickRecord}
            className="p-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Record journal for today (Ctrl + R)"
            aria-label="Record journal for today (Ctrl + R)"
          >
            <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div 
          className="relative group cursor-pointer hover:-translate-y-[1px] transition-transform ml-1" 
          onClick={logOut}
          title="Sign out"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full border border-[#E3E3E3]" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-200 border border-[#E3E3E3]" />
          )}
        </div>
      </div>
    </nav>
  );
}
