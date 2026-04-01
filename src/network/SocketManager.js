/**
 * SocketManager.js — Singleton wrapper around socket.io-client.
 *
 * Provides emit / volatileEmit / on / off helpers and tracks connection state.
 * All multiplayer events flow through this manager.
 */

import { io } from 'socket.io-client';
import { CONFIG } from '@/config.js';

export class SocketManager {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this.socket = null;
    this.connected = false;
  }

  /** Open the socket connection (idempotent). */
  connect() {
    if (this.socket) return;

    this.socket = io(CONFIG.SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Socket] Connected —', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('[Socket] Disconnected —', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }

  /** Reliable emit (buffered if temporarily disconnected). */
  emit(event, data) {
    this.socket?.emit(event, data);
  }

  /** Volatile emit — drops the packet if not currently connected (ideal for position sync). */
  volatileEmit(event, data) {
    if (this.socket && this.connected) {
      this.socket.volatile.emit(event, data);
    }
  }

  /** Subscribe to a server event. */
  on(event, cb) {
    this.socket?.on(event, cb);
  }

  /** Unsubscribe from a server event. */
  off(event, cb) {
    if (cb) this.socket?.off(event, cb);
    else this.socket?.removeAllListeners(event);
  }

  /** Tear down the connection. */
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }
}
