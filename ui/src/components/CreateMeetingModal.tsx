import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { createMeeting } from '@/lib/firebase';
import { generateMeetingLink } from '@/lib/utils';

interface CreateMeetingModalProps {
  userId: string;
  onClose: () => void;
  onMeetingCreated: (meetingId: string) => void;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  userId,
  onClose,
  onMeetingCreated,
}) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsCreating(true);
      const meetingId = await createMeeting(userId, recipientEmail);
      const meetingLink = generateMeetingLink(meetingId);
      
      // Copy link to clipboard
      await navigator.clipboard.writeText(meetingLink);
      
      onMeetingCreated(meetingId);
      toast.success('Meeting created! Link copied to clipboard.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Create New Meeting</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Enter the email of the person you want to call
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Recipient's Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Meeting'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};