// src/utils/socket.ts
// Bridges the native WebSocket in sessionStore to a Socket.io-like event API
// so HistoryScreen can subscribe to events without importing the full store

type EventHandler = (data: any) => void;

const listeners = new Map<string, Set<EventHandler>>();

/**
 * Called by sessionStore when a WS message arrives
 * Emits to all registered listeners for that event type
 */
export function emitSocketEvent(event: string, data: any) {
  const handlers = listeners.get(event);
  if (handlers) {
    // Use Array.from to avoid modification during iteration
    Array.from(handlers).forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.warn(`Handler error for event ${event}:`, err);
      }
    });
  }
}

/**
 * Socket.io-compatible API used by HistoryScreen and other components
 */
export const socket = {
  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);
  },
  
  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler) {
    const handlers = listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      // Clean up empty sets to prevent memory leaks
      if (handlers.size === 0) {
        listeners.delete(event);
      }
    }
  },
  
  /**
   * Check if connected (always true for native WS bridge)
   */
  get connected() {
    return true;
  },
};

/**
 * Helper to get the socket instance 
 */
export const getSocket = () => socket;