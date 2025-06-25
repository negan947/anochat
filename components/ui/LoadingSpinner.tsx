"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "secure" | "phantom";
  className?: string;
}

export function LoadingSpinner({ size = "md", variant = "default", className }: LoadingSpinnerProps) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8",
  };

  const variants = {
    default: "border-anon-600 border-t-anon-300",
    secure: "border-secure-600 border-t-secure-300",
    phantom: "border-phantom-600 border-t-phantom-300",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2",
        sizes[size],
        variants[variant],
        className
      )}
    />
  );
}

interface SkeletonProps {
  className?: string;
  variant?: "text" | "avatar" | "button" | "card";
}

export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  const variants = {
    text: "h-4 w-full",
    avatar: "h-10 w-10 rounded-full",
    button: "h-10 w-24 rounded-lg",
    card: "h-32 w-full rounded-lg",
  };

  return (
    <div
      className={cn(
        "skeleton rounded",
        variants[variant],
        className
      )}
    />
  );
}

export function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-xs lg:max-w-md space-y-2 ${i % 2 === 0 ? 'items-end' : 'items-start'} flex flex-col`}>
            <Skeleton className="h-3 w-16" />
            <div className="bg-anon-700 rounded-lg p-3 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-anon-900">
      {/* Header Skeleton */}
      <div className="bg-anon-800 border-b border-anon-700 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
      </div>

      {/* Messages Skeleton */}
      <div className="flex-1">
        <MessageSkeleton />
      </div>

      {/* Input Skeleton */}
      <div className="bg-anon-800 border-t border-anon-700 p-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function IdentitySkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="text-center space-y-4">
        <Skeleton className="h-32 w-32 rounded-lg mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
      
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="bg-anon-800 rounded-lg p-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Skeleton variant="button" className="flex-1" />
        <Skeleton variant="button" className="flex-1" />
      </div>
    </div>
  );
}

interface TypingIndicatorProps {
  users?: string[];
  className?: string;
}

export function TypingIndicator({ users = ["Someone"], className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-center space-x-2 text-anon-400 text-sm", className)}>
      <div className="typing-indicator">
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
      </div>
      <span>
        {users.length === 1 
          ? `${users[0]} is typing...`
          : `${users.slice(0, -1).join(", ")} and ${users[users.length - 1]} are typing...`
        }
      </span>
    </div>
  );
} 