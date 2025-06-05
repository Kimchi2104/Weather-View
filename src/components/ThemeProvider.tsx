
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

// Duplicating these here for ThemeProvider context, can be moved to a util file
const AURA_GRADIENT_STORAGE_KEY = 'aura-custom-gradient-colors';
const GRADIENT_DIRECTION = '135deg'; // Ensure this matches customizer
interface AuraGradientColors {
  color1: string;
  color2: string;
}

function applyAuraGradientFromStorage() {
  const savedColorsRaw = localStorage.getItem(AURA_GRADIENT_STORAGE_KEY);
  if (savedColorsRaw) {
    try {
      const savedColors = JSON.parse(savedColorsRaw) as AuraGradientColors;
      const gradientValue = `linear-gradient(${GRADIENT_DIRECTION}, ${savedColors.color1}, ${savedColors.color2})`;
      document.documentElement.style.setProperty('--aura-gradient', gradientValue);
    } catch (e) {
      console.error("Failed to parse/apply saved gradient colors from ThemeProvider", e);
      localStorage.removeItem(AURA_GRADIENT_STORAGE_KEY);
      document.documentElement.style.removeProperty('--aura-gradient');
    }
  } else {
    document.documentElement.style.removeProperty('--aura-gradient');
  }
}

function AppInitializerEffect() {
  const { theme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    // Apply custom gradient if Aura Glass is active (either directly or resolved system theme)
    if (theme === "aura-glass" || (theme === "system" && resolvedTheme === "aura-glass")) {
      applyAuraGradientFromStorage();
    } else {
      // If not Aura Glass, ensure no inline style overrides CSS
      document.documentElement.style.removeProperty('--aura-gradient');
    }
  }, [theme, resolvedTheme]); // Re-run when theme or resolvedTheme changes

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <AppInitializerEffect />
      {children}
    </NextThemesProvider>
  );
}
