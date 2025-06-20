import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Divider,
  Tooltip,
  Badge
} from '@mui/material';
import { X, Mic, MicOff, Video, VideoOff, ScreenShare, Crown } from 'lucide-react';
import { Participant } from '../../types';

interface ParticipantsListProps {
  participants: Participant[];
  onClose: () => void;
}

const ParticipantsList = ({ participants, onClose }: ParticipantsListProps) => {
  // Get current user ID from localStorage
  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;

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
      {/* Header */}
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
        <Typography variant="h6">
          Participants ({participants.length})
        </Typography>
        <IconButton onClick={onClose} edge="end">
          <X size={20} />
        </IconButton>
      </Box>

      {/* Participants list */}
      <List sx={{ flex: 1, overflowY: 'auto' }}>
        {participants.map((participant) => (
          <Box key={participant.id}>
            <ListItem
              secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title={participant.isMuted ? "Microphone Off" : "Microphone On"}>
                    <IconButton edge="end" size="small" disabled>
                      {participant.isMuted ? 
                        <MicOff size={16} color="#f44336" /> : 
                        <Mic size={16} color="#4caf50" />
                      }
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title={participant.isVideoOn ? "Video On" : "Video Off"}>
                    <IconButton edge="end" size="small" disabled>
                      {participant.isVideoOn ? 
                        <Video size={16} color="#4caf50" /> : 
                        <VideoOff size={16} color="#f44336" />
                      }
                    </IconButton>
                  </Tooltip>
                  
                  {participant.isScreenSharing && (
                    <Tooltip title="Sharing Screen">
                      <IconButton edge="end" size="small" disabled>
                        <ScreenShare size={16} color="#2196f3" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              }
            >
              <ListItemAvatar>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    participant.isHost ? (
                      <Tooltip title="Host">
                        <Crown size={12} color="#FFD700" />
                      </Tooltip>
                    ) : null
                  }
                >
                  <Avatar src={participant.avatar} alt={participant.name} />
                </Badge>
              </ListItemAvatar>
              <ListItemText 
                primary={
                  <Typography>
                    {participant.name} 
                    {participant.id === currentUserId && ' (You)'}
                  </Typography>
                } 
              />
            </ListItem>
            <Divider variant="inset" component="li" />
          </Box>
        ))}
      </List>
    </Box>
  );
};

export default ParticipantsList;