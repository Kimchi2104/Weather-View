
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw, Save } from 'lucide-react';

const AURA_GRADIENT_STORAGE_KEY = 'aura-custom-gradient-colors';
const DEFAULT_GRADIENT_COLORS = {
  color1: '#a1c4fd',
  color2: '#c2e9fb',
};
const GRADIENT_DIRECTION = '135deg';
const LUMINANCE_THRESHOLD = 0.5; // Values > 0.5 are considered light backgrounds

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Helper function to calculate perceived luminance (0-1 range)
function calculateLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getAverageLuminance(hexColors: string[]): number {
  let totalLuminance = 0;
  let validColors = 0;
  for (const hex of hexColors) {
    if (!hex) continue;
    const rgb = hexToRgb(hex);
    if (rgb) {
      totalLuminance += calculateLuminance(rgb.r, rgb.g, rgb.b);
      validColors++;
    }
  }
  return validColors > 0 ? totalLuminance / validColors : 0; // Default to 0 (dark) if no valid colors
}

export interface AuraGradientColors {
 color1: string;
  color2: string;
  color3?: string;
}

export function applyAuraVisuals(colors: AuraGradientColors | null) {
  const docElement = document.documentElement;
  if (colors && colors.color1 && colors.color2) {
    let gradientValue;
    const activeColorsForLuminance: string[] = [colors.color1, colors.color2];

    if (colors.color3) {
      activeColorsForLuminance.push(colors.color3);
      gradientValue = `linear-gradient(${GRADIENT_DIRECTION}, ${colors.color1}, ${colors.color2}, ${colors.color3})`;
    } else {
      gradientValue = `linear-gradient(${GRADIENT_DIRECTION}, ${colors.color1}, ${colors.color2})`;
    }
    docElement.style.setProperty('--aura-gradient', gradientValue);

    const avgLuminance = getAverageLuminance(activeColorsForLuminance.filter(Boolean));
    docElement.dataset.auraProse = avgLuminance > LUMINANCE_THRESHOLD ? 'dark' : 'light';

  } else {
    docElement.style.removeProperty('--aura-gradient');
    docElement.removeAttribute('data-aura-prose');
  }
}

const AuraGradientCustomizer: React.FC = () => {
  const { toast } = useToast();
  const [color1, setColor1] = useState(DEFAULT_GRADIENT_COLORS.color1);
  const [color2, setColor2] = useState(DEFAULT_GRADIENT_COLORS.color2);
  const [color3, setColor3] = useState<string | undefined>(undefined);
  const [showColor3, setShowColor3] = useState(false);

  const [previewGradient, setPreviewGradient] = useState(
    `linear-gradient(${GRADIENT_DIRECTION}, ${DEFAULT_GRADIENT_COLORS.color1}, ${DEFAULT_GRADIENT_COLORS.color2})`
  );

  const loadSavedColors = useCallback(() => {
    const savedColorsRaw = localStorage.getItem(AURA_GRADIENT_STORAGE_KEY);
    if (savedColorsRaw && savedColorsRaw !== 'undefined') {
      try {
        const savedColors = JSON.parse(savedColorsRaw) as AuraGradientColors;
        setColor1(savedColors.color1);
        setColor2(savedColors.color2);
        if (savedColors.color3) {
          setColor3(savedColors.color3);
          setShowColor3(true);
        }
        // applyAuraVisuals(savedColors); // Apply visuals on load, ThemeProvider will also do this.
      } catch (e) {
        console.error("Failed to parse saved gradient colors", e);
        localStorage.removeItem(AURA_GRADIENT_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    loadSavedColors();
  }, [loadSavedColors]);

  useEffect(() => {
    const gradientColors = [color1, color2, color3].filter(Boolean).join(', ');
    setPreviewGradient(`linear-gradient(${GRADIENT_DIRECTION}, ${gradientColors})`);
  }, [color1, color2, color3]);

  const handleSave = () => {
    const newColors: AuraGradientColors = { color1, color2 };
    if (color3) {
      newColors.color3 = color3;
    }
    localStorage.setItem(AURA_GRADIENT_STORAGE_KEY, JSON.stringify(newColors));
    applyAuraVisuals(newColors);
    toast({
      title: "Aura Gradient Saved",
      description: "Your custom background gradient and text colors have been applied.",
    });
  };

  const handleReset = () => {
    localStorage.removeItem(AURA_GRADIENT_STORAGE_KEY);
    applyAuraVisuals(null); 
    // Reset local state to default for customizer UI
    setColor1(DEFAULT_GRADIENT_COLORS.color1);
    setColor2(DEFAULT_GRADIENT_COLORS.color2);
    setColor3(undefined);
    setShowColor3(false);
    toast({
      title: "Aura Gradient Reset",
      description: "Background gradient and text colors have been reset to default.",
    });
  };

  return (
    <div className="space-y-6 p-2">
      <div className="space-y-3">
        <div>
          <Label htmlFor="auraColor1" className="text-sm font-medium">Color 1</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              id="auraColor1"
              value={color1}
              onChange={(e) => setColor1(e.target.value)}
              className="w-10 h-10 p-0 border-none rounded-md cursor-pointer"
              aria-label="First gradient color"
            />
            <Input
              type="text"
              value={color1}
              onChange={(e) => setColor1(e.target.value)}
              className="h-10 flex-grow"
              aria-labelledby="auraColor1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="auraColor2" className="text-sm font-medium">Color 2</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              id="auraColor2"
              value={color2}
              onChange={(e) => setColor2(e.target.value)}
              className="w-10 h-10 p-0 border-none rounded-md cursor-pointer"
              aria-label="Second gradient color"
            />
            <Input
              type="text"
              value={color2}
              onChange={(e) => setColor2(e.target.value)}
              className="h-10 flex-grow"
              aria-labelledby="auraColor2"
            />
          </div>
        </div>

        {showColor3 && (
          <div>
            <Label htmlFor="auraColor3" className="text-sm font-medium">Color 3</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                id="auraColor3"
                value={color3 || '#cccccc'}
                onChange={(e) => setColor3(e.target.value)}
                className="w-10 h-10 p-0 border-none rounded-md cursor-pointer"
                aria-label="Third gradient color"
              />
              <Input
                type="text"
                value={color3 || ''}
                onChange={(e) => setColor3(e.target.value)}
                className="h-10 flex-grow"
                aria-labelledby="auraColor3"
              />
            </div>
          </div>
        )}

        {!showColor3 && (
          <Button variant="outline" onClick={() => { setShowColor3(true); setColor3('#cccccc'); }} className="w-full">+ Add third color</Button>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium">Live Preview</Label>
        <div
          className="mt-1 h-24 w-full rounded-md border border-border"
          style={{ background: previewGradient }}
          aria-label="Gradient preview"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={handleReset} className="gap-1.5">
          <RefreshCcw size={16} />
          Reset
        </Button>
        <Button onClick={handleSave} className="gap-1.5">
          <Save size={16} />
          Save & Apply
        </Button>
      </div>
    </div>
  );
};

export default AuraGradientCustomizer;
