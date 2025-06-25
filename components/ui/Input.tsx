"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "secure" | "ghost";
  error?: string;
  icon?: React.ReactNode;
  label?: string;
  description?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type = "text",
    variant = "default", 
    error,
    icon,
    label,
    description,
    disabled,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const baseStyles = `
      flex h-10 w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200
      file:border-0 file:bg-transparent file:text-sm file:font-medium
      placeholder-anon-500 
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
    `;
    
    const variants = {
      default: `
        bg-anon-900 border-anon-600 text-anon-100
        hover:border-anon-500 focus:border-anon-400
        focus-visible:ring-anon-400
      `,
      secure: `
        bg-secure-950 border-secure-700 text-secure-100
        hover:border-secure-600 focus:border-secure-500
        focus-visible:ring-secure-500 shadow-inner-glow
      `,
      ghost: `
        bg-transparent border-anon-700 text-anon-100
        hover:border-anon-500 hover:bg-anon-900
        focus:border-anon-400 focus:bg-anon-900
        focus-visible:ring-anon-400
      `,
    };

    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-anon-200">
            {label}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-anon-500">
              {icon}
            </div>
          )}
          
          <input
            type={inputType}
            className={cn(
              baseStyles,
              variants[variant],
              icon && "pl-10",
              isPassword && "pr-10",
              error && "border-red-500 focus:border-red-500 focus-visible:ring-red-500",
              isFocused && "ring-2",
              className
            )}
            ref={ref}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          
          {isPassword && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-anon-500 hover:text-anon-300 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 18m6.878-8.122L18 12m-8.122-2.122L15 3" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}
        </div>
        
        {description && !error && (
          <p className="text-xs text-anon-500">{description}</p>
        )}
        
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input }; 