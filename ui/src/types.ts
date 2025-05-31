export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
}

export interface Participant {
  id: string;
  name: string;
  isScreenSharing: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Meeting {
  id: string;
  title: string;
  hostId: string;
  recipientEmail: string;
  createdAt: Date;
  scheduledFor?: Date;
  participants: string[];
  status: 'pending' | 'active' | 'ended';
  isPrivate: boolean;
}

export interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  meetingId: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: Date;
}