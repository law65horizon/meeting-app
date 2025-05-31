import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { nanoid } from 'nanoid';
import { auth } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateMeetingLink(meetingId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join/${meetingId}`;
}

export function extractMeetingId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts[pathParts.length - 1] || null;
  } catch {
    return null;
  }
}

export function formatTimeLeft(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff <= 0) return 'Starting now';
  
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function isValidRecipient(meeting: any): boolean {
  if (!auth.currentUser) return false;
  return meeting.recipientEmail === auth.currentUser.email || 
         meeting.hostId === auth.currentUser.uid;
}

export function getMeetingStatus(meeting: any): string {
  if (!meeting) return 'unknown';
  
  if (meeting.status === 'ended') return 'ended';
  if (meeting.participants.length >= 2) return 'active';
  return 'pending';
}