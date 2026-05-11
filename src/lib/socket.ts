import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const socketService = {
  connect: (token: string) => {
    if (socket) return socket;

    socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
    });

    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  getSocket: () => socket
};
