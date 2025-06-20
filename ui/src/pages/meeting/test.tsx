import React, { useEffect, useRef, useState } from 'react';
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
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, RemoteStream>>({});
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const consumerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize Socket.IO and Mediasoup device
  useEffect(() => {
    const socketInstance = io('http://localhost:3000', {
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
    if (!socket || !deviceRef.current) return;

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
    socket.emit('createTransport', { isProducer: true }, async (transportData: TransportData) => {
      if (!transportData || transportData.error) {
        console.error('Failed to create producer transport:', transportData?.error);
        return;
      }

      try {
        producerTransportRef.current = deviceRef.current!.createSendTransport(transportData);

        producerTransportRef.current.on('connect', ({ dtlsParameters }, callback) => {
          socket.emit('connectTransport', { transportId: transportData.id, dtlsParameters }, () => {
            callback();
          });
        });

        producerTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback) => {
          socket.emit('produce', { kind, rtpParameters }, ({ id }: ProducerResponse) => {
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
    socket.emit('createTransport', { isProducer: false }, async (transportData: TransportData) => {
      if (!transportData || transportData.error) {
        console.error('Failed to create consumer transport:', transportData?.error);
        return;
      }

      try {
        consumerTransportRef.current = deviceRef.current!.createRecvTransport(transportData);

        consumerTransportRef.current.on('connect', ({ dtlsParameters }, callback) => {
          socket.emit('connectTransport', { transportId: transportData.id, dtlsParameters }, () => {
            callback();
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
    socket.on('newProducer', ({ producerId, kind }: NewProducerData) => {
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
        stream.addTrack(consumer.track); // Correct: consumer.track is a MediaStreamTrack
        setRemoteStreams((prev) => ({
          ...prev,
          [consumer.id]: { stream, consumerId: consumer.id },
        }));
        console.log('Subscribed to producer:', producerId);

        // Resume consumer to start receiving media
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

  return (
    <div style={{ padding: '20px' }}>
      <h1>WebRTC SFU Video Call</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3>Local Video</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            style={{ width: '300px', height: '200px', border: '1px solid black' }}
          />
        </div>
        {Object.entries(remoteStreams).map(([id]) => (
          <div key={id}>
            <h3>Remote Video {id}</h3>
            <video
              id={`remote-video-${id}`}
              autoPlay
              style={{ width: '300px', height: '200px', border: '1px solid black' }}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => subscribeToProducer(Object.keys(remoteStreams)[0] || 'manual')}
        disabled={!socket}
        style={{ marginTop: '10px' }}
      >
        Subscribe to Producer
      </button>
    </div>
  );
};

export default App;