import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateMeetingLink } from '@/lib/utils';

interface MeetingLinkProps {
  meetingId: string;
}

export const MeetingLink: React.FC<MeetingLinkProps> = ({ meetingId }) => {
  const [copied, setCopied] = useState(false);
  const meetingLink = generateMeetingLink(meetingId);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      toast.success('Meeting link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
      <input
        type="text"
        value={meetingLink}
        readOnly
        className="flex-1 bg-transparent border-none focus:outline-none text-sm"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        className="h-8 px-2"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};