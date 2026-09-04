import { EventEmitter } from "node:events";

type RealtimeEvent = {
  conversationId: string;
  type?: "update" | "typing" | "presence";
  userName?: string;
  userId?: string;
  isTyping?: boolean;
  isOnline?: boolean;
};

const realtimeGlobal = globalThis as typeof globalThis & {
  knotRealtime?: EventEmitter;
};

const realtime = realtimeGlobal.knotRealtime ?? new EventEmitter();
realtime.setMaxListeners(100);
realtimeGlobal.knotRealtime = realtime;

export function publishRealtimeUpdate(userIds: string[], event: RealtimeEvent) {
  for (const userId of userIds) realtime.emit(`user:${userId}`, event);
}

export function subscribeToRealtimeUpdates(userId: string, listener: (event: RealtimeEvent) => void) {
  const channel = `user:${userId}`;
  realtime.on(channel, listener);
  return () => realtime.off(channel, listener);
}
