import React, { useEffect, useState } from 'react';
import { VideoGrid } from './VideoGrid';
import { Controls } from './Controls';
import { ChatMessage, JoinRequest, Participant } from '@/types';
import { Chat } from './Chat';
import { initController, ready, start } from '@/lib/webrtc';
import { useAuth } from '@/hooks/useAuth';

interface MeetingProps {
  participants: Participant[];
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  pendingRequests: JoinRequest[];
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onLeaveCall: () => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void; // Fix type
  localStream: MediaStream | null;
  meetingId: string;
}

const MeetingForum: React.FC<MeetingProps> = ({
  participants,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isChatOpen,
  pendingRequests,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onLeaveCall,
  onApproveRequest,
  onRejectRequest,
  messages,
  localStream,
  onSendMessage,
  meetingId,
}) => {
  const { user: firebaseUser } = useAuth();
  const [ppt, setPpt] = useState(participants);


  useEffect(() => {
    if (participants.length === 0 || !meetingId) {
      console.log('No participants or meeting ID');
      return;
    }
    console.log('Initializing WebRTC', participants);
    const localParticipant = participants.find(item => item.local === true);
    if (localParticipant && meetingId) {
      initController(localParticipant, participants, meetingId);
      // start(meetingId, localParticipant.id);
    }
  }, [participants, meetingId]);


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-4">
          <div className={`flex-1 ${isChatOpen ? 'w-3/4' : 'w-full'}`}>
            <button id="startButton" onClick={start}>
              Start
            </button>
            <div className="bg-card rounded-lg shadow-lg overflow-hidden border border-border">
              <VideoGrid participants={participants} localStream={localStream} />
              <Controls
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                isScreenSharing={isScreenSharing}
                isChatOpen={isChatOpen}
                pendingRequests={pendingRequests}
                onToggleMute={onToggleMute}
                onToggleVideo={onToggleVideo}
                onToggleScreenShare={onToggleScreenShare}
                onToggleChat={onToggleChat}
                onLeaveCall={onLeaveCall}
                onApproveRequest={onApproveRequest}
                onRejectRequest={onRejectRequest}
              />
            </div>
          </div>
          {isChatOpen && (
            <div className="w-1/4 h-[calc(100vh-4rem)]">
              <Chat messages={messages} onSendMessage={onSendMessage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingForum;