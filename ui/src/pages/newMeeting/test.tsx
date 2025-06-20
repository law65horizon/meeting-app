import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  CircularProgress,
  SwipeableDrawer
} from '@mui/material';
import { 
  ArrowLeft,
  Clock,
  MoreVertical,
  MessageSquare,
  Users
} from 'lucide-react';
import VideoGrid from '../../components/video/VideoGrid'
import MeetingControls from '../../components/meeting/MeetingControls';
import ChatPanel from '../../components/chat/ChatPanel';
import ParticipantsList from '../../components/meeting/ParticipantsList';
import { useNewMeetingStore } from '../../store/newMeetingStore';
import { Notification } from '../../types';

const NewMeetingRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const {
    currentMeeting,
    participants,
    messages,
    isChatOpen,
    isParticipantsListOpen,
    isScreenSharing,
    selectedLayout,
    toggleChat,
    toggleParticipantsList,
    notifications,
    clearNotification,
    fetchMeeting
  } = useNewMeetingStore();
  

  const [allParticipants, setAllParticipants] = useState(participants)
  const [mainParticipants, setMainParticipants] = useState<any>()
  const [extraParticipants, setextraParticipants] = useState<any>()
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Find screen sharing participant if any
  const screenShareParticipant = useMemo(() => 
    participants.find(p => p.isScreenSharing),
    [participants]
  );

//   console.log(mainParticipants, extraParticipants)
  
  // Calculate unread messages
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    setAllParticipants(participants)
    let mainParticipants = participants?.slice(0, isMobile? 4 : 9)
    let extraParticipants = participants?.slice(isMobile? 4 : 9)
    setMainParticipants(mainParticipants)
    setextraParticipants(extraParticipants)
  }, [participants])
  
  useEffect(() => {
    if (!isChatOpen) {
      setUnreadMessages(prev => prev + 1);
    }
  }, [messages.length, isChatOpen]);
  
  useEffect(() => {
    if (isChatOpen) {
      setUnreadMessages(0);
    }
  }, [isChatOpen]);
  
  // Fetch meeting data
  useEffect(() => {
    if (id) {
      const loadMeeting = async () => {
        setLoading(true);
        await fetchMeeting(id);
        setLoading(false);
      };
      
      loadMeeting();
    }
  }, [id, fetchMeeting]);
  
  // Set up timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const formatElapsedTime = () => {
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const seconds = elapsedTime % 60;
    
    return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const handleLeaveMeeting = () => {
    navigate('/dashboard');
  };
  
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress />
        <Typography>Loading meeting...</Typography>
      </Box>
    );
  }
  
  // Calculate drawer width based on screen size
  const drawerWidth = isDesktop ? '30%' : isTablet ? '40%' : '100%';
  
  return ( 
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden',  width:'100%', bgcolor: 'black' }}>
      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
        //   height: '100%',
          display: 'flex',
          bgcolor: 'red',
          flexDirection: 'column',
          ...(isChatOpen && isTablet && !isMobile && {  
            // width: `calc(100% - ${drawerWidth})`
            width:'100%'
          })
        }}
      >
        {/* App bar */}
        <AppBar 
          position="static" 
          color="transparent" 
          elevation={0}
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: 'background.paper' 
          }}
        >
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={handleLeaveMeeting}>
              <ArrowLeft />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2, flexGrow: 1 }}>
              {currentMeeting?.title || 'Meereting'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <Clock size={16} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {formatElapsedTime()}
                </Typography>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>
        
        {/* Video grid */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <VideoGrid
            participants={participants}
            layout={selectedLayout}
            screenShareParticipantId={screenShareParticipant?.id}
          />
        </Box>
        
        {/* Meeting controls */}
        <MeetingControls
          onLeave={handleLeaveMeeting}
          onToggleChat={toggleChat}
          onToggleParticipants={toggleParticipantsList}
          unreadMessages={unreadMessages}
        />
      </Box>
      
      
      
      {/* Notifications */}
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open
          autoHideDuration={6000}
          onClose={() => clearNotification(notification.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => clearNotification(notification.id)} 
            severity={notification.type}
            variant="filled"
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
};

export default NewMeetingRoom;