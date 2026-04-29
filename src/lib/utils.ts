import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  
  // Handle Firestore Timestamp object
  if (typeof dateVal === 'object' && 'seconds' in dateVal && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  
  // Handle existing Date object
  if (dateVal instanceof Date) return dateVal;
  
  // Try parsing as string or number
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) {
    return new Date(); // Fallback to current time safely
  }
  return date;
}

export function formatDate(dateVal: any) {
  const date = safeDate(dateVal);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatTime(dateVal: any) {
  const date = safeDate(dateVal);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateTime(dateVal: any) {
  const date = safeDate(dateVal);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getAvatarPlaceholder(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}
