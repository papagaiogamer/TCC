import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();
export function useSocket() { return useContext(SocketContext); }

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const s = io('http://localhost:3000');
    setSocket(s);
    return () => s.close();
  }, []);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}