import { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  IconButton, 
  Typography, 
  Badge, 
  Drawer, 
  Grid, 
  Paper, 
  Avatar, 
  Tooltip, 
  List, 
  ListItem, 
  TextField, 
  Button,
  Divider,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Share, 
  MoreVertical, 
  Users, 
  Pin, 
  ScreenShare,
  Settings,
  X,
  Send
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import userData from '../../mocks/users.json';
import chatData from '../../mocks/chat.json';
import { Participant, ChatMessage } from '../../types';
import io, {Socket} from 'socket.io-client'
import * as mediasoupClient from 'mediasoup-client'


// Types for WebRTC and Mediasoup
interface TransportData {
  id: string;
  iceParameters: mediasoupClient.types.IceParameters;
  iceCandidates: mediasoupClient.types.IceCandidate[];
  dtlsParameters: mediasoupClient.types.DtlsParameters;
  error?: string;
}

interface ProducerResponse {
  id: string;
}

interface ConsumerData {
  id: string;
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
  rtpParameters: mediasoupClient.types.RtpParameters;
  error?: string;
}

interface NewProducerData {
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
}

interface RemoteStream {
  stream: MediaStream;
  consumerId: string | null;
}

const MeetingRoom = () => {
  const [participants, setParticipants] = useState<Participant[]>(userData.participants);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(chatData.messages);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsTab, setSettingsTab] = useState(0);

  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, RemoteStream>>({});
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const consumerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { id } = useParams();
  const navigate = useNavigate();
  
  const drawerWidth = 320;
  
  // Auto-select the first few participants to be pinned
  const mainParticipants = isScreenSharing 
    ? participants.filter(p => p.isScreenSharing || p.id === 'u1')
    : participants.slice(0, isMobile ? 4 : 9);
  const extraParticipants = isScreenSharing 
    ? participants.filter(p => !p.isScreenSharing && p.id !== 'u1')
    : participants.slice(isMobile ? 4 : 9);
    
    // Initialize Socket.IO and Mediasoup device
  useEffect(() => {
    const socketInstance = io('localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(socketInstance);

    // Initialize Mediasoup device
    deviceRef.current = new mediasoupClient.Device();

    socketInstance.on('connect', () => {
      console.log('Connected to server via Socket.IO:', socketInstance.id);
      // Load Mediasoup device with router RTP capabilities
      socketInstance.emit('getRouterRtpCapabilities', {}, (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
        deviceRef.current!.load({ routerRtpCapabilities })
          .then(() => {
            console.log('Mediasoup device loaded');
            start(socketInstance);
          })
          .catch((error) => {
            console.error('Failed to load Mediasoup device:', error);
          });
      });
    });

    socketInstance.on('connect_error', (error: Error) => {
      console.error('Socket.IO connection failed:', error.message);
      alert('Failed to connect to the server. Please check your network or server status.');
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.warn('Disconnected from server:', reason);
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    return () => {
      socketInstance.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (producerTransportRef.current) {
        producerTransportRef.current.close();
      }
      if (consumerTransportRef.current) {
        consumerTransportRef.current.close();
      }
    };
  }, []);

  // Start WebRTC setup
  const start = async (socketInstance: typeof socket) => {
    if (!socketInstance || !deviceRef.current) return;

    try {
      // Capture local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('Local media captured');
    } catch (error) {
      console.error('Failed to capture media:', error);
      alert('Could not access camera or microphone. Please grant permissions.');
      return;
    }

    // Create producer transport
    socketInstance.emit('createTransport', { isProducer: true }, async (transportData: TransportData) => {
      if (!transportData || transportData.error) {
        console.error('Failed to create producer transport:', transportData?.error);
        return;
      }

      try {
        producerTransportRef.current = deviceRef.current!.createSendTransport(transportData);

        producerTransportRef.current.on('connect', ({ dtlsParameters }, callback, errback) => {
          console.log('Producer transport connect event triggered');
          socketInstance.emit('connectTransport', { transportId: transportData.id, dtlsParameters }, (response:any) => {
            if (response.success) {
              console.log('Producer transport connected successfully');
              callback();
            } else {
              console.error('Failed to connect producer transport:', response.error);
              errback(new Error(response.error));
            }
          });
        });

        producerTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          socketInstance.emit('produce', { kind, rtpParameters }, ({ id }: ProducerResponse) => {
            callback({ id });
            console.log('Producer created with ID:', id);
          });
        });

        // Produce video and audio tracks
        for (const track of localStreamRef.current!.getTracks()) {
          await producerTransportRef.current.produce({
            track,
            encodings: track.kind === 'video' ? [
              { maxBitrate: 200000, scalabilityMode: 'L1T3' },
              { maxBitrate: 500000, scalabilityMode: 'L1T3' },
              { maxBitrate: 1500000, scalabilityMode: 'L1T3' },
            ] : undefined,
            codecOptions: track.kind === 'video' ? { videoGoogleStartBitrate: 1000 } : undefined,
          });
        }
      } catch (error) {
        console.error('Error setting up producer transport:', error);
      }
    });

    // Create consumer transport
    socketInstance.emit('createTransport', { isProducer: false }, async (transportData: TransportData) => {
      if (!transportData || transportData.error) {
        console.error('Failed to create consumer transport:', transportData?.error);
        return;
      }

      try {
        consumerTransportRef.current = deviceRef.current!.createRecvTransport(transportData);

        consumerTransportRef.current.on('connect', ({ dtlsParameters }, callback, errback) => {
          console.log('Consumer transport connect event triggered');
          socketInstance.emit('connectTransport', { transportId: transportData.id, dtlsParameters }, (response:any) => {
            if (response.success) {
              console.log('Consumer transport connected successfully');
              callback();
            } else {
              console.error('Failed to connect consumer transport:', response.error);
              errback(new Error(response.error));
            }
          });
        });

        consumerTransportRef.current.on('connectionstatechange', (state) => {
          console.log('Consumer transport state:', state);
        });
      } catch (error) {
        console.error('Error setting up consumer transport:', error);
      }
    });

    // Listen for new producers
    socketInstance.on('newProducer', ({ producerId, kind }: NewProducerData) => {
      if (kind === 'video') {
        subscribeToProducer(producerId);
        console.log('New producer available:', producerId);
      }
    });
  };

  // Subscribe to a producer
  const subscribeToProducer = async (producerId: string) => {
    if (!socket || !deviceRef.current || !consumerTransportRef.current) return;

    socket.emit('subscribe', { producerId });
    socket.emit('consume', {
      producerId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    }, async (consumerData: ConsumerData) => {
      if (consumerData.error) {
        console.error('Failed to consume producer:', consumerData.error);
        return;
      }

      try {
        const consumer = await consumerTransportRef.current!.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        const stream = new MediaStream();
        stream.addTrack(consumer.track);
        setRemoteStreams((prev) => ({
          ...prev,
          [consumer.id]: { stream, consumerId: consumer.id },
        }));
        console.log('Subscribed to producer:', producerId);

        socket.emit('resumeConsumer', { consumerId: consumer.id });
      } catch (error) {
        console.error('Error consuming producer:', error);
      }
    });
  };

  // Render remote video elements
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([id, { stream }]) => {
      const videoElement = document.getElementById(`remote-video-${id}`) as HTMLVideoElement;
      if (videoElement && !videoElement.srcObject) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams]);
  
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const newChatMessage: ChatMessage = {
        id: `msg${chatMessages.length + 1}`,
        senderId: 'u1',
        senderName: 'John Doe',
        content: newMessage,
        timestamp: new Date().toISOString(),
        isPrivate: false
      };
      
      setChatMessages([...chatMessages, newChatMessage]);
      setNewMessage('');
    }
  };
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const toggleParticipantVideo = (id: string) => {
    setParticipants(
      participants.map(p => 
        p.id === id ? { ...p, isVideoOn: !p.isVideoOn } : p
      )
    );
  };
  
  const toggleParticipantAudio = (id: string) => {
    setParticipants(
      participants.map(p => 
        p.id === id ? { ...p, isAudioOn: !p.isAudioOn } : p
      )
    );
  };
  
  const toggleScreenSharing = () => {
    if (isScreenSharing) {
      setParticipants(
        participants.map(p => ({ ...p, isScreenSharing: false }))
      );
    } else {
      setParticipants(
        participants.map(p => 
          p.id === 'u1' ? { ...p, isScreenSharing: true } : { ...p, isScreenSharing: false }
        )
      );
    }
    setIsScreenSharing(!isScreenSharing);
  };
  
  const handleLeaveMeeting = () => {
    navigate('/');
  };

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden' }}>
      {/* Main app bar */}
      <AppBar 
        position="fixed" 
        color="default" 
        sx={{ 
          boxShadow: 'none', 
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {id === 'personal-room' ? 'Personal Meeting Room' : 'Weekly Team Sync'}
          </Typography>
          
          <Box sx={{ display: 'flex' }}>
            <Tooltip title="Meeting settings">
              <IconButton 
                color="inherit" 
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={20} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Participants">
              <IconButton 
                color="inherit" 
                onClick={() => setIsParticipantsOpen(true)} 
                sx={{ ml: 1 }}
              >
                <Badge badgeContent={participants.length} color="primary">
                  <Users size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Chat">
              <IconButton 
                color="inherit" 
                onClick={() => setIsChatOpen(true)}
                sx={{ ml: 1 }}
              >
                <Badge badgeContent={chatMessages.length > 0 ? '!' : null} color="primary">
                  <MessageSquare size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="More options">
              <IconButton 
                color="inherit" 
                onClick={handleMenuOpen}
                sx={{ ml: 1 }}
              >
                <MoreVertical size={20} />
              </IconButton>
            </Tooltip>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleMenuClose}>Record meeting</MenuItem>
              <MenuItem onClick={handleMenuClose}>Blur background</MenuItem>
              <MenuItem onClick={handleMenuClose}>Use virtual background</MenuItem>
              <Divider />
              <MenuItem onClick={() => {
                handleMenuClose();
                setConfirmLeaveOpen(true);
              }} sx={{ color: 'error.main' }}>
                Leave meeting
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content - Video grid */}
      <Box
        sx={{
          height: 'calc(100vh - 64px - 80px)',
          bgcolor: '#121212',
          overflow: 'hidden',
          position: 'relative',
          p: 2
        }}
      >
        {isScreenSharing ? (
          // Screen sharing layout
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Screen share content takes most of the space */}
            <Box 
              sx={{ 
                flexGrow: 1, 
                bgcolor: '#000', 
                borderRadius: 2, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <img 
                src="https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                alt="Screen Share" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain' 
                }} 
              />
              
              {/* Small video of the screen sharer */}
              <Box
                sx={{
                  position: 'absolute',
                  right: 16,
                  top: 16,
                  width: '180px',
                  height: '101px',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '2px solid white'
                }}
              >
                <Box
                  component="div"
                  sx={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${participants.find(p => p.isScreenSharing)?.avatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'flex-end',
                    p: 1
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {participants.find(p => p.isScreenSharing)?.name} (You)
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            {/* Row of participants at the bottom */}
            <Box sx={{ height: '120px', display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
              {extraParticipants.map(participant => (
                <Paper
                  key={participant.id}
                  sx={{
                    width: '180px',
                    height: '100%',
                    borderRadius: 2,
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                    bgcolor: participant.isVideoOn ? undefined : '#333'
                  }}
                >
                  {participant.isVideoOn ? (
                    <Box
                      component="div"
                      sx={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${participant.avatar})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Avatar 
                        src={participant.avatar} 
                        sx={{ width: 64, height: 64 }}
                      >
                        {participant.name.charAt(0)}
                      </Avatar>
                    </Box>
                  )}
                  
                  {/* Participant info overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      p: 1,
                      bgcolor: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'white' }}>
                      {participant.name}
                    </Typography>
                    {!participant.isAudioOn && (
                      <MicOff size={16} color="white" />
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : (
          // Normal video grid layout
          <>
            <Grid 
              container 
              spacing={1} 
              sx={{ height: '100%' }}
            >
              {mainParticipants.map(participant => (
                <Grid 
                  item 
                  xs={isMobile ? 6 : isTablet ? 4 : 4} 
                  key={participant.id}
                  sx={{ 
                    height: isMobile ? 'calc(50% - 16px)' : 
                            isTablet ? 'calc(50% - 16px)' : 
                            'calc(33.333% - 16px)'
                  }}
                >
                  <Paper
                    sx={{
                      height: '100%',
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      bgcolor: participant.isVideoOn ? undefined : '#333',
                      border: participant.id === 'u1' ? '2px solid #3f51b5' : 'none'
                    }}
                  >
                    {participant.isVideoOn ? (
                      <Box
                        component="div"
                        sx={{
                          width: '100%',
                          height: '100%',
                          backgroundImage: `url(${participant.avatar})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Avatar 
                          src={participant.avatar} 
                          sx={{ width: 64, height: 64 }}
                        >
                          {participant.name.charAt(0)}
                        </Avatar>
                      </Box>
                    )}
                    
                    {/* Participant info overlay */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 1.5,
                        bgcolor: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                        {participant.name} {participant.id === 'u1' && '(You)'}
                      </Typography>
                      <Box>
                        {participant.isHost && (
                          <Tooltip title="Meeting host">
                            <IconButton size="small" sx={{ p: 0, mr: 0.5 }}>
                              <Badge
                                color="primary"
                                variant="dot"
                                sx={{ 
                                  '& .MuiBadge-badge': { 
                                    right: 3,
                                    top: 3
                                  }
                                }}
                              >
                                <Avatar sx={{ width: 18, height: 18, bgcolor: 'white', color: '#121212', fontSize: '0.75rem' }}>H</Avatar>
                              </Badge>
                            </IconButton>
                          </Tooltip>
                        )}
                        {!participant.isAudioOn && (
                          <MicOff size={16} color="white" />
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            
            {/* Additional participants strip */}
            {extraParticipants.length > 0 && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  bottom: 16, 
                  left: 0, 
                  right: 0, 
                  display: 'flex',
                  justifyContent: 'center',
                  px: 2
                }}
              >
                <Box 
                  sx={{ 
                    display: 'flex', 
                    gap: 1, 
                    overflowX: 'auto', 
                    bgcolor: 'rgba(0,0,0,0.4)',
                    borderRadius: 2,
                    p: 1,
                    maxWidth: '100%'
                  }}
                >
                  {extraParticipants.map(participant => (
                    <Tooltip title={participant.name} key={participant.id}>
                      <Avatar 
                        src={participant.avatar}
                        sx={{ 
                          width: 40, 
                          height: 40,
                          border: '2px solid',
                          borderColor: participant.isAudioOn ? 'primary.main' : 'transparent',
                        }}
                      >
                        {participant.name.charAt(0)}
                      </Avatar>
                    </Tooltip>
                  ))}
                  
                  {extraParticipants.length > 5 && (
                    <Tooltip title="View all participants">
                      <Avatar 
                        sx={{ 
                          width: 40, 
                          height: 40,
                          bgcolor: 'primary.main'
                        }}
                        onClick={() => setIsParticipantsOpen(true)}
                      >
                        +{extraParticipants.length - 5}
                      </Avatar>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Controls bar */}
      <Box
        sx={{
          height: '80px',
          bgcolor: '#121212',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={isAudioOn ? 'Turn off microphone' : 'Turn on microphone'}>
            <IconButton 
              sx={{ 
                bgcolor: isAudioOn ? 'rgba(255,255,255,0.1)' : 'error.main', 
                '&:hover': { 
                  bgcolor: isAudioOn ? 'rgba(255,255,255,0.2)' : 'error.dark' 
                },
                color: 'white',
                width: 50,
                height: 50
              }}
              onClick={() => {
                setIsAudioOn(!isAudioOn);
                toggleParticipantAudio('u1');
              }}
            >
              {isAudioOn ? <Mic size={24} /> : <MicOff size={24} />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}>
            <IconButton 
              sx={{ 
                bgcolor: isVideoOn ? 'rgba(255,255,255,0.1)' : 'error.main', 
                '&:hover': { 
                  bgcolor: isVideoOn ? 'rgba(255,255,255,0.2)' : 'error.dark' 
                },
                color: 'white',
                width: 50,
                height: 50
              }}
              onClick={() => {
                setIsVideoOn(!isVideoOn);
                toggleParticipantVideo('u1');
              }}
            >
              {isVideoOn ? <VideoIcon size={24} /> : <VideoOff size={24} />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}>
            <IconButton 
              sx={{ 
                bgcolor: isScreenSharing ? 'primary.main' : 'rgba(255,255,255,0.1)', 
                '&:hover': { 
                  bgcolor: isScreenSharing ? 'primary.dark' : 'rgba(255,255,255,0.2)' 
                },
                color: 'white',
                width: 50,
                height: 50
              }}
              onClick={toggleScreenSharing}
            >
              <ScreenShare size={24} />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Show chat">
            <IconButton 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.1)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                color: 'white',
                width: 50,
                height: 50
              }}
              onClick={() => setIsChatOpen(true)}
            >
              <MessageSquare size={24} />
            </IconButton>
          </Tooltip>
          
          {!isMobile && (
            <Tooltip title="Share meeting">
              <IconButton 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.1)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                  color: 'white',
                  width: 50,
                  height: 50
                }}
              >
                <Share size={24} />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title="Leave meeting">
            <IconButton 
              sx={{ 
                bgcolor: 'error.main', 
                '&:hover': { bgcolor: 'error.dark' },
                color: 'white',
                width: 50,
                height: 50
              }}
              onClick={() => setConfirmLeaveOpen(true)}
            >
              <PhoneOff size={24} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Chat drawer */}
      <Drawer
        anchor="right"
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        sx={{
          '& .MuiDrawer-paper': { 
            width: drawerWidth, 
            bgcolor: 'background.paper',
            height: '100%'
          },
        }}
      >
        <AppBar position="static" color="default" elevation={0}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Chat
            </Typography>
            <IconButton edge="end" onClick={() => setIsChatOpen(false)}>
              <X size={20} />
            </IconButton>
          </Toolbar>
        </AppBar>
        
        <List sx={{ flexGrow: 1, overflow: 'auto', px: 2, height: 'calc(100% - 64px - 70px)' }}>
          {chatMessages.map((message) => (
            <ListItem 
              key={message.id} 
              alignItems="flex-start"
              sx={{ 
                flexDirection: 'column',
                alignItems: message.senderId === 'u1' ? 'flex-end' : 'flex-start',
                py: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                {message.senderId !== 'u1' && (
                  <Avatar 
                    src={participants.find(p => p.id === message.senderId)?.avatar}
                    sx={{ width: 24, height: 24, mr: 1 }}
                  >
                    {message.senderName.charAt(0)}
                  </Avatar>
                )}
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ mr: message.senderId === 'u1' ? 0 : 1 }}
                >
                  {message.senderId === 'u1' ? 'You' : message.senderName}
                </Typography>
                {message.senderId === 'u1' && (
                  <Avatar 
                    src={participants.find(p => p.id === message.senderId)?.avatar}
                    sx={{ width: 24, height: 24, ml: 1 }}
                  >
                    {message.senderName.charAt(0)}
                  </Avatar>
                )}
              </Box>
              
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: message.senderId === 'u1' ? 'primary.main' : 'background.default',
                  color: message.senderId === 'u1' ? 'white' : 'text.primary',
                  maxWidth: '75%'
                }}
              >
                <Typography variant="body2">
                  {message.content}
                </Typography>
              </Paper>
              
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {new Date(message.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Typography>
            </ListItem>
          ))}
        </List>
        
        <Box sx={{ 
          p: 2, 
          borderTop: '1px solid', 
          borderColor: 'divider',
          display: 'flex'
        }}>
          <TextField
            fullWidth
            placeholder="Type a message..."
            variant="outlined"
            size="small"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />
          <Button
            variant="contained"
            sx={{ ml: 1, minWidth: 'auto' }}
            onClick={handleSendMessage}
          >
            <Send size={18} />
          </Button>
        </Box>
      </Drawer>
      
      {/* Participants drawer */}
      <Drawer
        anchor="right"
        open={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        sx={{
          '& .MuiDrawer-paper': { 
            width: drawerWidth, 
            bgcolor: 'background.paper' 
          },
        }}
      >
        <AppBar position="static" color="default" elevation={0}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Participants ({participants.length})
            </Typography>
            <IconButton edge="end" onClick={() => setIsParticipantsOpen(false)}>
              <X size={20} />
            </IconButton>
          </Toolbar>
        </AppBar>
        
        <List sx={{ px: 2 }}>
          {participants.map((participant) => (
            <ListItem
              key={participant.id}
              secondaryAction={
                <Box>
                  {participant.id !== 'u1' && (
                    <Tooltip title="Pin participant">
                      <IconButton edge="end" size="small" sx={{ mr: 1 }}>
                        <Pin size={18} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={participant.isAudioOn ? 'Mute' : 'Unmuted'}>
                    <IconButton 
                      edge="end" 
                      size="small"
                      sx={{ 
                        color: participant.isAudioOn ? undefined : 'error.main' 
                      }}
                      onClick={() => toggleParticipantAudio(participant.id)}
                    >
                      {participant.isAudioOn ? <Mic size={18} /> : <MicOff size={18} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar src={participant.avatar} sx={{ mr: 2 }}>
                  {participant.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="body1">
                    {participant.name} {participant.id === 'u1' && '(You)'}
                  </Typography>
                  {participant.isHost && (
                    <Typography variant="caption" color="primary">
                      Meeting Host
                    </Typography>
                  )}
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      </Drawer>
      
      {/* Settings dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Meeting Settings</DialogTitle>
        <DialogContent>
          <Tabs 
            value={settingsTab} 
            onChange={(_, newValue) => setSettingsTab(newValue)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Audio & Video" />
            <Tab label="Background" />
            <Tab label="General" />
          </Tabs>
          
          {settingsTab === 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Audio Settings</Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>Microphone</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value="default"
                  sx={{ mb: 2 }}
                >
                  <MenuItem value="default">Default Microphone</MenuItem>
                  <MenuItem value="headset">Headset Microphone</MenuItem>
                </TextField>
                
                <Typography variant="body2" gutterBottom>Speaker</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value="default"
                >
                  <MenuItem value="default">Default Speaker</MenuItem>
                  <MenuItem value="headset">Headset Speaker</MenuItem>
                </TextField>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>Video Settings</Typography>
              <Box>
                <Typography variant="body2" gutterBottom>Camera</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value="default"
                >
                  <MenuItem value="default">Default Camera</MenuItem>
                  <MenuItem value="external">External Webcam</MenuItem>
                </TextField>
              </Box>
            </Box>
          )}
          
          {settingsTab === 1 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Background Options</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    width: 100, 
                    height: 60, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    borderColor: 'primary.main'
                  }}
                >
                  <Typography variant="body2">None</Typography>
                </Paper>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    width: 100, 
                    height: 60, 
                    bgcolor: '#f5f5f5'
                  }}
                >
                  <Typography variant="caption" sx={{ p: 1 }}>Blur</Typography>
                </Paper>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    width: 100, 
                    height: 60, 
                    backgroundImage: 'url(https://images.pexels.com/photos/1693095/pexels-photo-1693095.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                    backgroundSize: 'cover'
                  }}
                />
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    width: 100, 
                    height: 60, 
                    backgroundImage: 'url(https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                    backgroundSize: 'cover'
                  }}
                />
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>Upload Custom Background</Typography>
              <Button variant="outlined" sx={{ mt: 1 }}>
                Upload Image
              </Button>
            </Box>
          )}
          
          {settingsTab === 2 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>General Settings</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>Language</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value="en"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Español</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                </TextField>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>Meeting Preferences</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>Join meetings with</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant={isAudioOn ? "contained" : "outlined"} 
                    size="small"
                    onClick={() => setIsAudioOn(true)}
                    startIcon={<Mic size={16} />}
                  >
                    Mic On
                  </Button>
                  <Button 
                    variant={!isAudioOn ? "contained" : "outlined"} 
                    size="small"
                    onClick={() => setIsAudioOn(false)}
                    startIcon={<MicOff size={16} />}
                  >
                    Mic Off
                  </Button>
                </Box>
              </Box>
              
              <Box>
                <Typography variant="body2" gutterBottom>Join meetings with</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant={isVideoOn ? "contained" : "outlined"} 
                    size="small"
                    onClick={() => setIsVideoOn(true)}
                    startIcon={<VideoIcon size={16} />}
                  >
                    Video On
                  </Button>
                  <Button 
                    variant={!isVideoOn ? "contained" : "outlined"} 
                    size="small"
                    onClick={() => setIsVideoOn(false)}
                    startIcon={<VideoOff size={16} />}
                  >
                    Video Off
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => setSettingsOpen(false)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Confirm leave dialog */}
      <Dialog
        open={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Leave Meeting</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave this meeting?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeaveOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleLeaveMeeting}
          >
            Leave Meeting
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingRoom;