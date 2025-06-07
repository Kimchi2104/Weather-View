
'use client';

import type { FC } from 'react';
import { Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
// useTheme is not directly needed here anymore for conditional classes
// import { useTheme } from 'next-themes';

const Header: FC = () => {
  // const { theme, resolvedTheme } = useTheme();
  // const isAuraGlassActive = theme === 'aura-glass' || (theme === 'system' && resolvedTheme === 'aura-glass');

  // Reverted: Header component will always use its default classes.
  // Aura Glass specific styling for the header is now handled entirely by globals.css
  // via the `html.aura-glass header` selector.
  const headerElementClasses = 'bg-primary text-primary-foreground shadow-md';

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
