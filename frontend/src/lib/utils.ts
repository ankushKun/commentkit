import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "Yesterday", "Dec 25, 3:45 PM")
 * Consistent with commentkit.js widget formatting
 */
export function formatTimeAgo(date: string): string {
  // SQLite stores timestamps as UTC without 'Z' suffix, so we need to append it
  // to ensure JavaScript parses it as UTC and converts to local time
  const utcDate = date.includes('Z') || date.includes('+') ? date : date.replace(' ', 'T') + 'Z';
  const d = new Date(utcDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Same day: relative time
  if (d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()) {
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()) {
    return 'Yesterday';
  }

  // 2-6 days ago
  if (diffDays <= 6) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  // More than 6 days: show short date and time
  const dateStr = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
  return `${dateStr}, ${timeStr}`;
}
