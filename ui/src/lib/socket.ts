import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      
    });
  }
  return socket;
}

export async function connectSocket(roomId: string, token?: string, displayName?: string): Promise<Socket> {
  const s = getSocket();
  s.auth = { token, roomId, displayName };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}