"use client";

import React, { useState, forwardRef } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  headerAction?: React.ReactNode;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, id, error, hint, required, className, disabled, headerAction, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="space-y-1.5 w-full text-left">
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className="block text-xs font-semibold text-foreground select-none"
          >
            {label}
            {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          </label>
          {headerAction}
        </div>

        <div className="relative rounded-md">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground [&_svg]:size-4">
            <Lock className="w-4 h-4" />
          </div>

          <input
            ref={ref}
            id={id}
            name={id}
            type={showPassword ? "text" : "password"}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(
              "w-full h-9 text-sm bg-background text-foreground rounded-md border shadow-xs transition-all outline-none select-none pl-9 pr-9",
              "placeholder:text-muted-foreground placeholder:text-sm",
              error
                ? "border-destructive bg-destructive/5 focus:ring-1 focus:ring-destructive"
                : "border-input hover:bg-accent/50 focus:border-ring focus:bg-background focus:ring-1 focus:ring-ring",
              disabled && "opacity-50 cursor-not-allowed bg-muted",
              className
            )}
            {...props}
          />

          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
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

PasswordInput.displayName = "PasswordInput";
