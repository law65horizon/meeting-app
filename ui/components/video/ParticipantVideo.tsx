import { memo, useState, useEffect } from 'react';
import { Box, Typography, Avatar, IconButton } from '@mui/material';
import { Mic, MicOff, Pin, MoreVertical } from 'lucide-react';
import { Participant } from '../../types';

interface ParticipantVideoProps {
  participant: Participant;
  isLocal?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
  height?: string | number;
  width?: string | number;
}

const ParticipantVideo = ({
  participant,
  isLocal = false,
  isFocused = false,
  onClick,
  height = '100%',
  width = '100%',
}: ParticipantVideoProps) => {
  const [videoError, setVideoError] = useState(false);
  
  // In a real app, this would use WebRTC to show the actual video stream
  // Here we're just displaying a placeholder
  
  const { name, avatar, isMuted, isVideoOn, isHost } = participant;
  
  // Mock video failure for demo purposes
  useEffect(() => {
    setVideoError(!isVideoOn);
  }, [isVideoOn]);

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        width,
        backgroundColor: '#252525',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        border: isFocused ? '2px solid #3f51b5' : 'none',
      }}
      onClick={onClick}
    >
      {videoError ? (
        // Video off state - show avatar
        <Avatar
          src={avatar}
          alt={name}
          sx={{
            width: '30%',
            height: 'auto',
            aspectRatio: '1/1',
            fontSize: '3rem',
          }}
        />
      ) : (
        // Video on state - show placeholder video
        <Box
          component="img"
          src={avatar}
          alt={name}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Bottom info bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 1,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isMuted ? <MicOff size={16} color="#f44336" /> : <Mic size={16} color="#4caf50" />}
          <Typography variant="body2" sx={{ ml: 1, color: 'white' }}>
            {name} {isLocal && '(You)'} {isHost && '(Host)'}
          </Typography>
        </Box>

        {isFocused && (
          <IconButton size="small" sx={{ color: 'white' }}>
            <Pin size={16} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default memo(ParticipantVideo);