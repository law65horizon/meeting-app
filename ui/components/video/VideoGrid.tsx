import { useState, useMemo } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import ParticipantVideo from './ParticipantVideo';
import { Participant } from '../../types';

interface VideoGridProps {
  participants: Participant[];
  layout: 'grid' | 'focus' | 'presentation';
  screenShareParticipantId?: string;
}

const VideoGrid = ({
  participants,
  layout,
  screenShareParticipantId,
}: VideoGridProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);

  // Find local participant (current user)
  const localParticipant = useMemo(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return participants.find(p => p.id === user.id) || participants[0];
  }, [participants]);

  // Organize participants based on layout and screen size
  const organizedParticipants = useMemo(() => {
    let mainGridParticipants: Participant[] = [];
    let overflowParticipants: Participant[] = [];
    let screenShareParticipant: Participant | null = null;

    // Find screen sharing participant if exists
    if (screenShareParticipantId) {
      screenShareParticipant = participants.find(p => p.id === screenShareParticipantId) || null;
    }

    // Handle focus layout
    if (layout === 'focus' && focusedParticipantId) {
      const focused = participants.find(p => p.id === focusedParticipantId);
      if (focused) {
        mainGridParticipants = [focused];
        overflowParticipants = participants.filter(p => p.id !== focusedParticipantId);
      } else {
        mainGridParticipants = [...participants];
      }
    }
    // Handle presentation layout
    else if (layout === 'presentation' && screenShareParticipant) {
      mainGridParticipants = [screenShareParticipant];
      overflowParticipants = participants.filter(p => p.id !== screenShareParticipant.id);
    }
    // Handle grid layout
    else {
      const maxGridParticipants = isDesktop ? 9 : isTablet ? 6 : 4;
      mainGridParticipants = participants.slice(0, maxGridParticipants);
      overflowParticipants = participants.slice(maxGridParticipants);
    }

    return {
      mainGridParticipants,
      overflowParticipants,
      screenShareParticipant
    };
  }, [participants, layout, focusedParticipantId, screenShareParticipantId, isDesktop, isTablet]);

  const handleParticipantClick = (id: string) => {
    // In focus mode, clicking a participant should focus on them
    if (layout === 'grid') {
      setFocusedParticipantId(id === focusedParticipantId ? null : id);
    }
  };

  // Calculate grid dimensions based on number of participants
  const gridTemplateAreas = useMemo(() => {
    const count = organizedParticipants.mainGridParticipants.length;
    
    if (isDesktop) {
      if (count <= 1) return '"a"';
      if (count <= 2) return '"a b"';
      if (count <= 4) return '"a b" "c d"';
      if (count <= 6) return '"a b c" "d e f"';
      return '"a b c" "d e f" "g h i"'; // 7-9 participants
    }
    
    if (isTablet) {
      if (count <= 1) return '"a"';
      if (count <= 2) return '"a b"';
      if (count <= 4) return '"a b" "c d"';
      return '"a b c" "d e f"'; // 5-6 participants
    }
    
    // Mobile
    if (count <= 1) return '"a"';
    if (count <= 2) return '"a b"';
    return '"a b" "c d"'; // 3-4 participants
  }, [organizedParticipants.mainGridParticipants.length, isDesktop, isTablet]);

  // Calculate grid columns
  const gridTemplateColumns = useMemo(() => {
    const count = organizedParticipants.mainGridParticipants.length;
    
    if (isDesktop) {
      if (count <= 1) return '1fr';
      if (count <= 4) return 'repeat(2, 1fr)';
      return 'repeat(3, 1fr)';
    }
    
    if (isTablet) {
      if (count <= 1) return '1fr';
      if (count <= 4) return 'repeat(2, 1fr)';
      return 'repeat(3, 1fr)';
    }
    
    // Mobile
    if (count <= 1) return '1fr';
    return 'repeat(2, 1fr)';
  }, [organizedParticipants.mainGridParticipants.length, isDesktop, isTablet]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Main video grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateAreas,
          gridTemplateColumns,
          gridAutoRows: '1fr',
          gap: 2,
          flex: 1,
          p: 2,
        }}
      >
        {organizedParticipants.mainGridParticipants.map((participant, index) => (
          <Box
            key={participant.id}
            sx={{
              gridArea: String.fromCharCode(97 + index), // 'a', 'b', 'c', etc.
              aspectRatio: layout === 'presentation' ? 'auto' : '16/9',
            }}
          >
            <ParticipantVideo
              participant={participant}
              isLocal={participant.id === localParticipant?.id}
              isFocused={participant.id === focusedParticipantId}
              onClick={() => handleParticipantClick(participant.id)}
            />
          </Box>
        ))}
      </Box>

      {/* Overflow participants strip */}
      {organizedParticipants.overflowParticipants.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: isTablet && layout === 'presentation' ? 'column' : 'row',
            p: 1,
            gap: 1,
            backgroundColor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            overflowX: 'auto',
            ...(isTablet && layout === 'presentation' 
              ? {
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '100px',
                  height: '100%',
                  borderTop: 'none',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }
              : {
                  height: isMobile ? '80px' : '80px',
                })
          }}
        >
          {organizedParticipants.overflowParticipants.map((participant) => (
            <Box
              key={participant.id}
              sx={{
                flexShrink: 0,
                ...(isTablet && layout === 'presentation'
                  ? { width: '90px', height: '90px', mb: 1 }
                  : { width: '120px', height: '100%' })
              }}
            >
              <ParticipantVideo
                participant={participant}
                isLocal={participant.id === localParticipant?.id}
                onClick={() => handleParticipantClick(participant.id)}
                height="100%"
                width="100%"
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default VideoGrid;