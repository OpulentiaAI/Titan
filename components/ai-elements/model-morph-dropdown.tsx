"use client";

import { useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "google" | "gateway" | "nim" | "openrouter";

export interface ModelMorphDropdownProps {
  provider: Provider;
  value: string;
  onSelect: (modelId: string) => void;
  label?: string;
  className?: string;
}

// Simple text morph effect using framer-motion
function TextMorph({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("relative inline-block min-w-[3ch]", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={children}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, mass: 0.3 }}
          className="lowercase text-foreground"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function ModelMorphDropdown({ provider, value, onSelect, label = "Model", className }: ModelMorphDropdownProps) {
  const TRANSITION = {
    type: "spring" as const,
    stiffness: 280,
    damping: 18,
    mass: 0.3,
  };

  // Provide a compact list of curated models per provider (mirrors settings options succinctly)
  const options = useMemo(() => {
    if (provider === "openrouter") {
      return [
        { id: "openai/gpt-4o", name: "gpt-4o" },
        { id: "openai/gpt-4o-mini", name: "gpt-4o-mini" },
        { id: "minimax/minimax-m2:free", name: "minimax-m2:free" },
        { id: "google/gemini-2.5-flash", name: "gemini-2.5-flash" },
        { id: "google/gemini-2.5-pro", name: "gemini-2.5-pro" },
      ];
    }
    // gateway (Gemini) default
    return [
      { id: "google/gemini-2.5-flash", name: "gemini-2.5-flash" },
      { id: "google/gemini-2.5-pro", name: "gemini-2.5-pro" },
      { id: "google/gemini-1.5-flash", name: "gemini-1.5-flash" },
    ];
  }, [provider]);

  const selectedShort = useMemo(() => {
    // Show a short, friendly name (lowercase, simplified)
    const match = options.find(o => o.id === value);
    if (match) return match.name;
    // fallback to suffix after last '/'
    const parts = value?.split('/') || [];
    return (parts[parts.length - 1] || value || "model").toLowerCase();
  }, [options, value]);

  return (
    <div className={cn("inline-flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button
            layout="size"
            className={cn(
              "overflow-hidden rounded-lg px-2 py-1.5 transition-colors duration-200",
              "hover:bg-accent/60 bg-transparent border border-transparent"
            )}
            transition={TRANSITION}
            type="button"
          >
            <motion.div
              layout="preserve-aspect"
              className="inline-flex items-center gap-1"
              transition={TRANSITION}
            >
              <span className="text-muted-foreground">{label}</span>
              <TextMorph className="text-foreground/90">{selectedShort}</TextMorph>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="shadow-sm">
          {options.map((opt) => (
            <DropdownMenuItem key={opt.id} onClick={() => onSelect(opt.id)}>
              {opt.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

