import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // IMPORTANTE: Aponta para o backend na porta 3000
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    // Debug: Confirma no console se conectou
    newSocket.on('connect', () => {
        console.log('✅ React conectado ao servidor Socket.IO');
    });

    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}