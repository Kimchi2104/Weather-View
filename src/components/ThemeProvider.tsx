
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";
import { applyAuraVisuals, type AuraGradientColors as CustomizerAuraGradientColors } from './AuraGradientCustomizer';

const AURA_GRADIENT_STORAGE_KEY = 'aura-custom-gradient-colors';

function applyAuraVisualsFromStorage() {
  const savedColorsRaw = localStorage.getItem(AURA_GRADIENT_STORAGE_KEY);
  if (savedColorsRaw && savedColorsRaw !== 'undefined') {
    try {
      const savedColors = JSON.parse(savedColorsRaw) as CustomizerAuraGradientColors;
      applyAuraVisuals(savedColors);
    } catch (e) {
      console.error("Failed to parse/apply saved gradient visuals from ThemeProvider", e);
      localStorage.removeItem(AURA_GRADIENT_STORAGE_KEY);
      applyAuraVisuals(null); // Reset if parsing fails
    }
  } else {
    applyAuraVisuals(null); // Reset if no saved colors, or apply default aura gradient if needed
  }
}

function AppInitializerEffect() {
  const { theme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (theme === "aura-glass" || (theme === "system" && resolvedTheme === "aura-glass")) {
      applyAuraVisualsFromStorage();
    } else {
      // Explicitly call applyAuraVisuals(null) to ensure all Aura-specific things are reset.
      // This function handles removing both the inline gradient style and the data-aura-prose attribute.
      applyAuraVisuals(null);
    }
  }, [theme, resolvedTheme]);

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
