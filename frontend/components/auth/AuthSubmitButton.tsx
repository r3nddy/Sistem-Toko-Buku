"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function AuthSubmitButton({
  loading = false,
  loadingText = "Memproses...",
  children,
  className,
  disabled,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "w-full h-10 px-4 rounded-md font-semibold text-sm transition-all duration-150",
        "bg-[var(--primary,#0052CC)] text-white hover:bg-[var(--primary-hover,#0041A3)] active:scale-[0.99]",
        "shadow-xs flex items-center justify-center gap-2 cursor-pointer outline-hidden select-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
