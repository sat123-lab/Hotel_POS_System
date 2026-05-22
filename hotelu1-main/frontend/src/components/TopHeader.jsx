import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
  Search,
  Bell,
  Maximize2,
  HelpCircle,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

const TopHeader = ({ currentUser, handleLogout, notificationCount = 0 }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const requestFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const initials = (currentUser?.name || 'A').charAt(0).toUpperCase();
  const roleLabel = (currentUser?.role || 'user').charAt(0).toUpperCase() + (currentUser?.role || 'user').slice(1);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        {/* Hamburger (decorative on lg) */}
        <button
          className="hidden lg:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-50 text-gray-700"
          aria-label="Menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders, tables, menu items..."
              className="w-full pl-11 pr-16 py-2.5 rounded-full bg-gray-50 border border-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-200"
            />
            <span className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-400 bg-white font-mono">
              Ctrl K
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <button
            className="relative w-9 h-9 rounded-full hover:bg-gray-50 text-gray-500 hover:text-orange-500 flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          <button
            onClick={requestFullScreen}
            className="hidden sm:flex w-9 h-9 rounded-full hover:bg-gray-50 text-gray-500 hover:text-orange-500 items-center justify-center"
            aria-label="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            className="hidden sm:flex w-9 h-9 rounded-full hover:bg-gray-50 text-gray-500 hover:text-orange-500 items-center justify-center"
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Profile */}
          <div className="relative" ref={ddRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 pr-3 pl-1 py-1 rounded-full border border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 transition"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="hidden sm:block text-left">
                <span className="block text-sm font-semibold text-gray-800 leading-tight">
                  {currentUser?.name || 'User'}
                </span>
                <span className="block text-[11px] text-gray-500 leading-tight">{roleLabel}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-orange-50/50"
                  onClick={() => {
                    setOpen(false);
                    navigate('/dashboard');
                  }}
                >
                  <UserIcon className="w-4 h-4 text-gray-400" /> Profile
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    handleLogout?.();
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
