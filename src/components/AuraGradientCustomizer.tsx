
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Standard HTML input will be used for type="color"
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw, Save } from 'lucide-react';

const AURA_GRADIENT_STORAGE_KEY = 'aura-custom-gradient-colors';
const DEFAULT_GRADIENT_COLORS = {
  color1: '#a1c4fd',
  color2: '#c2e9fb',
};
const GRADIENT_DIRECTION = '135deg';

interface AuraGradientColors {
 color1: string;
  color2: string;
  color3?: string; // Make color3 optional
}

export function applyAuraGradient(colors: AuraGradientColors | null) {
  if (colors && colors.color1 && colors.color2) {
    let gradientValue;
    if (colors.color3) {
      gradientValue = `linear-gradient(${GRADIENT_DIRECTION}, ${colors.color1}, ${colors.color2}, ${colors.color3})`;
    } else {
      gradientValue = `linear-gradient(${GRADIENT_DIRECTION}, ${colors.color1}, ${colors.color2})`;
    }
    document.documentElement.style.setProperty('--aura-gradient', gradientValue);

  } else {
    // Reset to CSS-defined default by removing the inline style
    document.documentElement.style.removeProperty('--aura-gradient');
  }
}

const AuraGradientCustomizer: React.FC = () => {
  const { toast } = useToast();
  const [color1, setColor1] = useState(DEFAULT_GRADIENT_COLORS.color1);
  const [color2, setColor2] = useState(DEFAULT_GRADIENT_COLORS.color2);
  const [color3, setColor3] = useState<string | undefined>(undefined); // State for the optional third color
  const [showColor3, setShowColor3] = useState(false); // State to control visibility of the third color picker

  const [previewGradient, setPreviewGradient] = useState(
    `linear-gradient(${GRADIENT_DIRECTION}, ${DEFAULT_GRADIENT_COLORS.color1}, ${DEFAULT_GRADIENT_COLORS.color2})`
  );

  const loadSavedColors = useCallback(() => {
    const savedColorsRaw = localStorage.getItem(AURA_GRADIENT_STORAGE_KEY);
    if (savedColorsRaw && savedColorsRaw !== 'undefined') { // Check if savedColorsRaw is not null or "undefined" string

      try {
        const savedColors = JSON.parse(savedColorsRaw) as AuraGradientColors;
        setColor1(savedColors.color1);
        setColor2(savedColors.color2);
        if (savedColors.color3) {
          setColor3(savedColors.color3);
          setShowColor3(true);
        }
      } catch (e) {
        console.error("Failed to parse saved gradient colors", e);
        localStorage.removeItem(AURA_GRADIENT_STORAGE_KEY); // Clear corrupted data
      }
    }
  }, []);

  useEffect(() => {
    loadSavedColors();
  }, [loadSavedColors]);

  useEffect(() => {
    const gradientColors = [color1, color2, color3].filter(Boolean).join(', '); // Filter out undefined/null colors
    setPreviewGradient(`linear-gradient(${GRADIENT_DIRECTION}, ${gradientColors})`);
  }, [color1, color2, color3]);

  const handleSave = () => {
    const newColors: AuraGradientColors = { color1, color2 };
    if (color3) {
      newColors.color3 = color3;
    }
    localStorage.setItem(AURA_GRADIENT_STORAGE_KEY, JSON.stringify(newColors));
    applyAuraGradient(newColors);
    toast({
      title: "Aura Gradient Saved",
      description: "Your custom background gradient has been applied.",
    });
  };

  const handleReset = () => {
    localStorage.removeItem(AURA_GRADIENT_STORAGE_KEY); // Reset saved colors in localStorage
    applyAuraGradient(null); // Reset to CSS default
     toast({
      title: "Aura Gradient Reset",
      description: "Background gradient has been reset to default.",
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
                value={color3 || '#cccccc'} // Default to a light grey if color3 is undefined
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
