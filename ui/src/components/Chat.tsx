import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg shadow-lg">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Chat</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-foreground">{message.senderName}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-1 text-foreground bg-muted/50 p-2 rounded-lg">{message.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className={cn(
              "flex-1 px-3 py-2 rounded-lg",
              "bg-muted text-foreground",
              "border border-input",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          />
          <Button type="submit" size="icon" className="rounded-lg">
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
};