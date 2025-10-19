import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  actionData?: any;
}

type MessageHandler = (message: WebSocketMessage) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (messageType: string, handler: MessageHandler) => void;
  unsubscribe: (messageType: string, handler: MessageHandler) => void;
  sendMessage: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  username: string | null;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, username }) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualCloseRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000;

  const connect = useCallback(() => {
    if (!username) return;

    // Clear any existing connection
    if (wsRef.current) {
      isManualCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket('ws://localhost:1738');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send LOGIN message to identify this connection
        ws.send(JSON.stringify({
          type: 'login',
          username: username
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const messageType = data.type;

          console.log('[WebSocketContext] Received message:', messageType, data);
          console.log('[WebSocketContext] Current subscribers:', Array.from(subscribersRef.current.keys()));

          // Notify all subscribers for this message type
          const handlers = subscribersRef.current.get(messageType);
          if (handlers && handlers.size > 0) {
            console.log(`[WebSocketContext] Found ${handlers.size} handlers for ${messageType}`);
            handlers.forEach(handler => {
              try {
                handler(data);
              } catch (error) {
                console.error(`Error in message handler for ${messageType}:`, error);
              }
            });
          } else {
            console.log(`[WebSocketContext] No handlers found for message type: ${messageType}`);
          }

          // Also notify wildcard subscribers (*)
          const wildcardHandlers = subscribersRef.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach(handler => {
              try {
                handler(data);
              } catch (error) {
                console.error('Error in wildcard message handler:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Only attempt reconnection if not manually closed and user is still logged in
        if (!isManualCloseRef.current && username && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('Max reconnection attempts reached');
        }

        isManualCloseRef.current = false;
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [username]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      isManualCloseRef.current = true;

      // Send LOGOUT message before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'logout',
          username: username
        }));
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, [username]);

  const subscribe = useCallback((messageType: string, handler: MessageHandler) => {
    if (!subscribersRef.current.has(messageType)) {
      subscribersRef.current.set(messageType, new Set());
    }
    subscribersRef.current.get(messageType)!.add(handler);
    console.log(`[WebSocketContext] Subscribed to ${messageType}, total handlers: ${subscribersRef.current.get(messageType)!.size}`);
  }, []);

  const unsubscribe = useCallback((messageType: string, handler: MessageHandler) => {
    const handlers = subscribersRef.current.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      console.log(`[WebSocketContext] Unsubscribed from ${messageType}, remaining handlers: ${handlers.size}`);
      if (handlers.size === 0) {
        subscribersRef.current.delete(messageType);
      }
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }, []);

  // Connect when username is available, disconnect when it's not
  useEffect(() => {
    if (username) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [username, connect, disconnect]);

  const value: WebSocketContextType = {
    isConnected,
    subscribe,
    unsubscribe,
    sendMessage
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
