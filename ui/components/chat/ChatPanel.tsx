import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Divider,
  Avatar,
  List,
  ListItem,
  Paper,
  InputAdornment,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { SendHorizontal, X } from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';
import { ChatMessage, Participant } from '../../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to format timestamp - moved outside components to be accessible
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Helper function to get alpha color
function alpha(color: string, opacity: number): string {
  // Simple implementation for hex colors
  if (color.startsWith('#')) {
    return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  }
  return `rgba(${color}, ${opacity})`;
}

const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { messages, participants, sendMessage } = useMeetingStore();
  const [messageText, setMessageText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [recipientId, setRecipientId] = useState('everyone');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleSendMessage = () => {
    if (messageText.trim()) {
      if (isPrivate && recipientId !== 'everyone') {
        sendMessage(messageText, true, recipientId);
      } else {
        sendMessage(messageText, false);
      }
      setMessageText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRecipientChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    setRecipientId(value);
    setIsPrivate(value !== 'everyone');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Chat header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6">Chat</Typography>
        <IconButton onClick={onClose} edge="end">
          <X size={20} />
        </IconButton>
      </Box>

      {/* Messages list */}
      <List
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((message) => (
          <MessageItem 
            key={message.id} 
            message={message} 
            participants={participants} 
          />
        ))}
        <div ref={messagesEndRef} />
      </List>

      {/* Message input */}
      <Box
        component={Paper}
        elevation={0}
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <FormControl 
          variant="outlined" 
          size="small" 
          fullWidth 
          sx={{ mb: 2 }}
        >
          <InputLabel id="message-recipient-label">To</InputLabel>
          <Select
            labelId="message-recipient-label"
            id="message-recipient"
            value={recipientId}
            onChange={handleRecipientChange}
            label="To"
          >
            <MenuItem value="everyone">Everyone</MenuItem>
            {participants.map((participant) => (
              <MenuItem key={participant.id} value={participant.id}>
                {participant.name} {participant.isHost ? '(Host)' : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          multiline
          maxRows={3}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  color="primary"
                >
                  <SendHorizontal size={20} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {isPrivate && recipientId !== 'everyone' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            This message will only be visible to the selected recipient
          </Typography>
        )}
      </Box>
    </Box>
  );
};

interface MessageItemProps {
  message: ChatMessage;
  participants: Participant[];
}

const MessageItem = ({ message, participants }: MessageItemProps) => {
  const theme = useTheme();
  
  // Get current user ID from localStorage
  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
  
  // Check if this message is from or to the current user
  const isFromCurrentUser = message.senderId === currentUserId;
  const isPrivateToCurrentUser = message.isPrivate && message.recipientId === currentUserId;
  
  // Get recipient name for private messages
  let recipientName = '';
  if (message.isPrivate && message.recipientId) {
    const recipient = participants.find(p => p.id === message.recipientId);
    recipientName = recipient?.name || 'Unknown';
  }

  return (
    <ListItem
      alignItems="flex-start"
      disableGutters
      disablePadding
      sx={{
        mb: 1,
        backgroundColor: message.isPrivate 
          ? (isFromCurrentUser || isPrivateToCurrentUser 
              ? alpha(theme.palette.primary.main, 0.1)
              : 'transparent')
          : 'transparent',
        borderRadius: 1,
        p: message.isPrivate ? 1 : 0,
      }}
    >
      <Box sx={{ display: 'flex', width: '100%' }}>
        <Avatar
          src={message.senderAvatar}
          alt={message.senderName}
          sx={{ width: 32, height: 32, mr: 1 }}
        />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2" component="span">
              {message.senderName} 
              {isFromCurrentUser && ' (You)'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(message.timestamp)}
            </Typography>
          </Box>
          
          {message.isPrivate && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 0.5 }}>
              {isFromCurrentUser 
                ? `Private to ${recipientName}` 
                : 'Private message to you'}
            </Typography>
          )}
          
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.message}
          </Typography>
        </Box>
      </Box>
    </ListItem>
  );
};

export default ChatPanel;