import React from 'react';
import { X, UserPlus, UserX } from 'lucide-react';
import type { JoinRequest } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface JoinRequestModalProps {
  requests: JoinRequest[];
  onClose: () => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  requests,
  onClose,
  onApprove,
  onReject,
}) => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Join Requests</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium text-foreground">{request.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(request.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => onApprove(request.id)}
                      variant="ghost"
                      size="icon"
                      className="text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400"
                    >
                      <UserPlus className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={() => onReject(request.id)}
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive/90"
                    >
                      <UserX className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};