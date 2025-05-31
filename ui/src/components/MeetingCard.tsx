import React from "react";
import { Calendar, Users, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MeetingLink } from "@/components/MeetingLink";
import { formatTimeLeft } from "@/lib/utils";
import type { Meeting } from "@/types";

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (meetingId: string) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onJoin,
}) => {
  const timeLeft = formatTimeLeft(meeting.scheduledFor || new Date());
  const isActive = meeting.status === "active";
  const isPending = meeting.status === "pending";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <h3 className="font-medium">{meeting.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="text-sm text-muted-foreground">{timeLeft}</span>
          )}
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-800"
                : isPending
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
            }`}
          >
            {meeting.status}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{new Date(meeting.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{meeting.participants.length} participants</span>
          </div>
        </div>

        {/* {isPending && meeting.hostId === auth?.currentUser?.uid && (
          <MeetingLink meetingId={meeting.id} />
        )} */}

        {(isPending || isActive) && (
          <Button
            onClick={() => onJoin(meeting.id)}
            className="w-full"
            variant={isActive ? "default" : "secondary"}
          >
            {isActive ? "Join Now" : "Start Meeting"}
          </Button>
        )}
      </div>
    </Card>
  );
};
