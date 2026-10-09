"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, id, error, icon, hint, required, className, disabled, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full text-left">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-foreground select-none"
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>

        <div className="relative rounded-md">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground [&_svg]:size-4">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            name={id}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(
              "w-full h-9 text-sm bg-background text-foreground rounded-md border shadow-xs transition-all outline-none select-none",
              "placeholder:text-muted-foreground placeholder:text-sm",
              icon ? "pl-9 pr-3" : "px-3",
              error
                ? "border-destructive bg-destructive/5 focus:ring-1 focus:ring-destructive"
                : "border-input hover:bg-accent/50 focus:border-ring focus:bg-background focus:ring-1 focus:ring-ring",
              disabled && "opacity-50 cursor-not-allowed bg-muted",
              className
            )}
            {...props}
          />
        </div>

        {error && (
          <p id={`${id}-error`} className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1" role="alert">
            {error}
          </p>
        )}

        {!error && hint && (
          <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground,#5C6B63)] mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
