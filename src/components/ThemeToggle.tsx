
"use client";

import * as React from "react";
import { Moon, Sun, Laptop, Sparkles, Palette } from "lucide-react"; // Added Sparkles & Palette
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import AuraGradientCustomizer from "./AuraGradientCustomizer";


export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [isCustomizerOpen, setIsCustomizerOpen] = React.useState(false);

  return (
    <Dialog open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 aura-glass:-rotate-90 aura-glass:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 aura-glass:-rotate-90 aura-glass:scale-0" />
            <Sparkles className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all aura-glass:rotate-0 aura-glass:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="mr-2 h-4 w-4" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("aura-glass")}>
            <Sparkles className="mr-2 h-4 w-4" />
            Aura Glass
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            <DropdownMenuItem
              disabled={theme !== "aura-glass" && theme !== "system"} // Enable only if aura is active or could become active via system
              onSelect={(e) => {
                if (theme !== "aura-glass" && theme !== "system") {
                   e.preventDefault(); // Prevent closing menu if disabled
                }
                // If system is current and might resolve to aura, or aura is current: open dialog
                // Actual check if system *resolves* to aura is tricky here, so we simplify:
                // If theme is aura, or system (could be aura), allow opening.
                // `onOpenChange` of Dialog will handle `setIsCustomizerOpen`.
              }}
            >
              <Palette className="mr-2 h-4 w-4" />
              Customize Aura Gradient
            </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Laptop className="mr-2 h-4 w-4" />
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Customize Aura Glass Gradient</DialogTitle>
          <DialogDescription>
            Select two colors to personalize your background gradient. Changes are saved locally.
          </DialogDescription>
        </DialogHeader>
        <AuraGradientCustomizer />
      </DialogContent>
    </Dialog>
  );
}
