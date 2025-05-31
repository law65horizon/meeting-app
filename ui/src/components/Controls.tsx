import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Monitor as MonitorShare, MessageCircle, UserPlus } from 'lucide-react';
import { JoinRequestModal } from './JoinRequestModal';
import type { JoinRequest } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ControlsProps {
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
}

export const Controls: React.FC<ControlsProps> = ({
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
}) => {
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 bottom-8 mx-auto flex w-fit items-center justify-center gap-3 p-3 bg-gray-500 backdrop-blur-sm rounded-[40px] shadow-lg">
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="icon"
          onClick={onToggleMute}
          className={cn(
            "rounded-full transition-all",
            isMuted && "hover:bg-destructive/90"
          )}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button
          variant={isVideoOff ? "destructive" : "secondary"}
          size="icon"
          onClick={onToggleVideo}
          className={cn(
            "rounded-full transition-all",
            isVideoOff && "hover:bg-destructive/90"
          )}
        >
          {isVideoOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </Button>

        <Button
          variant={isScreenSharing ? "default" : "secondary"}
          size="icon"
          onClick={onToggleScreenShare}
          className="rounded-full"
        >
          <MonitorShare className="w-5 h-5" />
        </Button>

        <Button
          variant={isChatOpen ? "default" : "secondary"}
          size="icon"
          onClick={onToggleChat}
          className="rounded-full"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>

        {pendingRequests.length > 0 && (
          <Button
            variant="default"
            size="icon"
            onClick={() => setShowRequestsModal(true)}
            className="rounded-full relative"
          >
            <UserPlus className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingRequests.length}
            </span>
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          onClick={onLeaveCall}
          className="rounded-full"
        >
          <Phone className="w-5 h-5 transform rotate-135" />
        </Button>
      </div>

      {showRequestsModal && (
        <JoinRequestModal
          requests={pendingRequests}
          onClose={() => setShowRequestsModal(false)}
          onApprove={onApproveRequest}
          onReject={onRejectRequest}
        />
      )}
    </>
  );
};