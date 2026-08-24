import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context; // Can return null if socket is not connected yet
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { idToken } = useAuth();

  useEffect(() => {
    // If no token exists, guarantee socket is closed
    if (!idToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to server (either from env or fallback to 5000 in local dev)
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
    console.log(`[Socket] Establishing connection to: ${serverUrl}`);

    const socketInstance = io(serverUrl, {
      auth: {
        token: idToken,
      },
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected successfully. Connection ID: ${socketInstance.id}`);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected from server. Reason: ${reason}`);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error(`[Socket] Connection Handshake Error: ${error.message}`);
      setIsConnected(false);
    });

    setSocket(socketInstance);

    // Disconnect when component unmounts or token changes
    return () => {
      console.log('[Socket] Cleaning up socket connection...');
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [idToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
