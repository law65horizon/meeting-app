export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  participants: string[];
  host: string;
  joinUrl: string;
  isRecurring: boolean;
  description?: string;
}

export interface Participant {
  id: string;
  name: string;
  isVideoOn?: boolean;
  isAudioOn?: boolean;
  isScreenSharing?: boolean;
  avatar?: string
  isHost?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isPrivate: boolean;
  recipientId?: string;
  senderAvatar?: string;
}

export interface MediaDevice {
  deviceId: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
  label: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
  isRead: boolean;
}