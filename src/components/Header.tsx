
'use client';

import type { FC } from 'react';
import { Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from 'next-themes';

const Header: FC = () => {
  const { theme, resolvedTheme } = useTheme(); // Use resolvedTheme to account for system preference

  // Determine if Aura Glass is active
  const isAuraGlassActive = theme === 'aura-glass' || (theme === 'system' && resolvedTheme === 'aura-glass');

  // Conditional classes for the <header> element
  const headerElementClasses = isAuraGlassActive
    ? 'bg-transparent shadow-none' // Aura Glass: transparent background, no shadow. Text/icon colors handled by globals.css
    : 'bg-primary text-primary-foreground shadow-md'; // Default themes

  return (
    <header className={headerElementClasses}>
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          {/* The 'text-accent' class will be overridden by 'html.aura-glass header .text-accent' for Aura */}
          <Zap size={32} className="mr-3 text-accent" />
          {/* Header title text color will be overridden by 'html.aura-glass header' for Aura */}
          <h1 className="text-3xl font-headline font-semibold">WeatherView</h1>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
