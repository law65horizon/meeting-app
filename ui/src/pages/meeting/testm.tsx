import React, { useEffect, useRef, useState } from 'react';
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
import io, { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';

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



const App: React.FC = () => {
  const roomId = 'main-room'
  const socketRef = useRef<typeof Socket | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, RemoteStream>>({});
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const consumerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const sendTransport = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransport = useRef<mediasoupClient.types.Transport | null>(null);
  const sendTransportParams = useRef<TransportData | null>(null);
  const recvTransportParams = useRef<TransportData | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const consumerList = new Map()

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
    const socketInstance = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socketInstance;

    // Initialize Mediasoup device
    deviceRef.current = new mediasoupClient.Device();

    socketInstance.on('connect', () => {
      console.log('Connected to server via Socket.IO:', socketInstance.id);
      // Load Mediasoup device with router RTP capabilities
      socketInstance.emit('joinRoom', {roomId, rtpCapabilities: null}, (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
        deviceRef.current!.load({ routerRtpCapabilities })
          .then(() => {
            console.log('Mediasoup device loaded');
            start();
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
  const start = async () => {
    if (!socketRef.current || !deviceRef.current) return;

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

    socketRef.current.emit("createWebRtcTransport", {
      roomId,
      clientRtpCapabilities: deviceRef.current.rtpCapabilities,
      direction: "send"
    }, async (params: any) => {
      sendTransportParams.current = params;

      sendTransport.current = deviceRef.current!.createSendTransport({
        id : params.id,
        iceParameters   : params.iceParameters,
        iceCandidates   : params.iceCandidates,
        dtlsParameters  : params.dtlsParameters,
        // You can pass `iceServers` if needed
      }); // :contentReference[oaicite:26]{index=26}

      // 3.a) Handle “connect” on Send Transport → send DTLS params to server
      sendTransport.current.on("connect", ({ dtlsParameters }, callback, errback) => {
        socketRef.current?.emit("connectTransport", {
          roomId,
          transportId   : sendTransportParams.current!.id,
          dtlsParameters
        }, (res:any) => {
          if (res.error) return errback(res.error);
          callback();
        });
      });

      // 3.b) Handle “produce” on Send Transport → send producer params to server
      sendTransport.current.on("produce", async (parameters, callback, errback) => {
        if(!socketRef.current) {
            console.log('no socket produce')
            return;
        };
        socketRef.current.emit("produce", {
          roomId,
          transportId  : sendTransportParams.current!.id,
          kind          : parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData       : { clientId: socketRef.current.id }
        }, (response:any) => {
          if (response.error) return errback(response.error);
          callback({ id: response.id });
        });
      });
      if(!localStreamRef.current) {
        console.warn('no local stream ref')
        return
      }
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      const videoTrack = localStreamRef.current.getVideoTracks()[0];

    //   // 4.a) Produce audio
    //   await sendTransport.current.produce({ track: audioTrack }); // :contentReference[oaicite:27]{index=27}

    //   // 4.b) Produce video
    //   await sendTransport.current.produce({
    //     track: videoTrack,
    //     // You can pass `encodings` / `codecOptions` here
    //   }); // :contentReference[oaicite:28]{index=28}

    //   localVideoRef.current!.play();
    });

    socketRef.current.on("newProducer", async ({ producerId, kind }:NewProducerData) => {
  // 5.a) Create a Recv Transport if not already created
  if (!recvTransport.current && socketRef.current) {
    socketRef.current.emit("createWebRtcTransport", {
      roomId,
      clientRtpCapabilities: deviceRef.current!.rtpCapabilities,
      direction: "recv"
    }, async (params: TransportData) => {
      recvTransportParams.current = params

      recvTransport.current = deviceRef.current!.createRecvTransport({
        id            : params.id,
        iceParameters : params.iceParameters,
        iceCandidates : params.iceCandidates,
        dtlsParameters: params.dtlsParameters
      }); // :contentReference[oaicite:29]{index=29}

      // 5.b) Handle connect on Recv Transport
      recvTransport.current.on("connect", ({ dtlsParameters }, callback, errback) => {
        socketRef.current!.emit("connectTransport", {
          roomId,
          transportId   : recvTransportParams.current!.id,
          dtlsParameters
        }, (res:any) => {
          if (res.error) return errback(res.error);
          callback();
        });
      });

      // Once transport is ready, actually consume the producer
      await consume(producerId, kind);
    });
  } else {
    // If recv Transport already exists, just consume
    await consume(producerId, kind);
  }
    });

    socketRef.current.on("producerClosed", ({ producerId }:any) => {
  const consumer = consumerList.get(producerId);
  if (consumer) {
    consumer.close();
    consumerList.delete(producerId);
    // Optionally remove the associated <video>/<audio> element
  }
});
  };

  // 5) When notified by server that a new producer is available:

async function consume(producerId: string, kind:string) {
  // 5.c) Ask server to create the Consumer
  if(!socketRef.current) {
    console.error('no socket consume')
    return;
  }
  socketRef.current.emit("consume", {
    roomId,
    consumerTransportId: recvTransportParams.current!.id,
    producerId,
    clientRtpCapabilities: deviceRef.current!.rtpCapabilities
  }, async (params:ConsumerData) => {
    if (params.error) {
      console.error(params.error);
      return;
    }

    const consumer = await recvTransport.current!.consume({
      id             : params.id,
      producerId     : params.producerId,
      kind           : params.kind,
      rtpParameters  : params.rtpParameters
      // type & appData also available if needed
    }); // :contentReference[oaicite:30]{index=30}

    consumerList.set(producerId, consumer);

    // 5.d) Once consumer is created, tell server to resume
    socketRef.current!.emit("consumerResume", {
      roomId,
      consumerId: consumer.id
    }, (res:any) => {
      if (res.error) console.error(res.error);
    });

    // 5.e) Hook up the incoming track to a <video> or <audio> element
    const stream = new MediaStream([ consumer.track ]);
    let el;
    if (kind === "video") {
      el = document.createElement("video");
      el.autoplay = true;
    } else {
      el = document.createElement("audio");
      el.autoplay = true;
    }
    el.srcObject = stream;
    // document.getElementById("remoteContainer").appendChild(el);
    setRemoteStreams((prev) => ({
        ...prev,
        [consumer.id]: {stream, consumerId: consumer.id}
    }))
  });
}

// 6) Handle producerClosed (peer left or stopped sending)



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

export default App;