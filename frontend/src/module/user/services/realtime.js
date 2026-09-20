import { io } from 'socket.io-client';
import { getSocketUrl } from '../../../shared/apiBase';

const socketUrl = getSocketUrl();

export const realtimeSocket = io(socketUrl, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export function onDatabaseChange(listener) {
  realtimeSocket.on('database:change', listener);
  return () => realtimeSocket.off('database:change', listener);
}
