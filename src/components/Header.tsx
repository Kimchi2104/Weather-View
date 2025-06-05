
'use client';

import { useEffect, useRef, type FC } from 'react';
import { Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from 'next-themes';
import { applyAuraGradient } from './AuraGradientCustomizer';

const Header: FC = () => {
  const { theme } = useTheme();
  const headerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);

  return (
    <header ref={headerRef} className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Zap ref={iconRef} size={32} className="mr-3 text-accent" />
          <h1 ref={titleRef} className="text-3xl font-headline font-semibold">WeatherView</h1>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
