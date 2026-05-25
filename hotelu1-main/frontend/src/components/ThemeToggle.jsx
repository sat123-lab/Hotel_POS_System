import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Small Sun/Moon toggle that lives next to the notification bell
 * in the top header. Clicking flips light ↔ dark.
 */
const ThemeToggle = ({ className = '' }) => {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      onClick={toggle}
      type="button"
      aria-label={label}
      title={label}
      className={
        'relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ' +
        'text-gray-500 hover:text-orange-500 hover:bg-gray-50 ' +
        'dark:text-gray-300 dark:hover:text-orange-400 dark:hover:bg-white/5 ' +
        className
      }
    >
      <span className="relative w-5 h-5 block">
        <Sun
          className={
            'absolute inset-0 w-5 h-5 transition-all duration-300 ' +
            (isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100')
          }
        />
        <Moon
          className={
            'absolute inset-0 w-5 h-5 transition-all duration-300 ' +
            (isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50')
          }
        />
      </span>
    </button>
  );
};

export default ThemeToggle;
