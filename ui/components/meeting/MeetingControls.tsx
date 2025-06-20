import { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Button,
  useTheme,
  useMediaQuery,
  Badge,
  Paper,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography
} from '@mui/material';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Users,
  Settings,
  ChevronUp
} from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';
import DeviceSettings from './DeviceSettings';

interface MeetingControlsProps {
  onLeave: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  unreadMessages: number;
}

const MeetingControls = ({
  onLeave,
  onToggleChat,
  onToggleParticipants,
  unreadMessages
}: MeetingControlsProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(!isMobile);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const { 
    isAudioMuted, 
    isVideoEnabled, 
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    toggleScreenShare
  } = useMeetingStore();

  const handleLeaveConfirm = () => {
    setConfirmLeaveOpen(false);
    onLeave();
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: isMobile ? '100%' : 'auto',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          backgroundColor: 'background.paper',
          transition: 'all 0.3s ease',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {!isMobile && (
          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            sx={{ 
              position: 'absolute', 
              top: -24, 
              backgroundColor: 'background.paper',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ChevronUp 
              size={16} 
              style={{ 
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease' 
              }} 
            />
          </IconButton>
        )}
        
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 1,
            gap: 1,
            width: '100%',
            ...(isMobile && { 
              flexWrap: 'wrap',
              padding: '8px 16px 16px 16px', 
            }),
            ...(expanded ? { height: 'auto' } : { height: 0, overflow: 'hidden', padding: 0 })
          }}
        >
          {/* Audio toggle */}
          <Tooltip title={isAudioMuted ? "Unmute" : "Mute"}>
            <IconButton 
              onClick={toggleAudio}
              sx={{ 
                backgroundColor: isAudioMuted ? 'error.dark' : 'success.dark',
                color: 'white',
                '&:hover': { 
                  backgroundColor: isAudioMuted ? 'error.main' : 'success.main',
                }
              }}
            >
              {isAudioMuted ? <MicOff /> : <Mic />}
            </IconButton>
          </Tooltip>
          
          {/* Video toggle */}
          <Tooltip title={isVideoEnabled ? "Stop Video" : "Start Video"}>
            <IconButton 
              onClick={toggleVideo}
              sx={{ 
                backgroundColor: isVideoEnabled ? 'success.dark' : 'error.dark',
                color: 'white',
                '&:hover': { 
                  backgroundColor: isVideoEnabled ? 'success.main' : 'error.main',
                }
              }}
            >
              {isVideoEnabled ? <Video /> : <VideoOff />}
            </IconButton>
          </Tooltip>
          
          {/* Screen share */}
          <Tooltip title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
            <IconButton 
              onClick={toggleScreenShare}
              sx={{ 
                backgroundColor: isScreenSharing ? 'primary.dark' : 'action.disabledBackground',
                color: isScreenSharing ? 'white' : 'text.primary',
                '&:hover': { 
                  backgroundColor: isScreenSharing ? 'primary.main' : 'action.hover',
                }
              }}
            >
              <ScreenShare />
            </IconButton>
          </Tooltip>
          
          {/* Participants */}
          <Tooltip title="Participants">
            <IconButton onClick={onToggleParticipants}>
              <Users />
            </IconButton>
          </Tooltip>
          
          {/* Chat */}
          <Tooltip title="Chat">
            <IconButton onClick={onToggleChat}>
              <Badge badgeContent={unreadMessages} color="error" max={99}>
                <MessageSquare />
              </Badge>
            </IconButton>
          </Tooltip>
          
          {/* Settings */}
          <Tooltip title="Settings">
            <IconButton onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
          </Tooltip>
          
          {/* Leave meeting */}
          <Button 
            variant="contained" 
            color="error"
            startIcon={<PhoneOff />}
            onClick={() => setConfirmLeaveOpen(true)}
            sx={{ ml: isMobile ? 0 : 2 }}
          >
            Leave
          </Button>
        </Box>
      </Paper>
      
      {/* Settings Dialog */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Device Settings</DialogTitle>
        <DialogContent>
          <DeviceSettings />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Confirm Leave Dialog */}
      <Dialog
        open={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
      >
        <DialogTitle>Leave Meeting?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave this meeting?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeaveOpen(false)}>Cancel</Button>
          <Button onClick={handleLeaveConfirm} variant="contained" color="error">
            Leave Meeting
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MeetingControls;