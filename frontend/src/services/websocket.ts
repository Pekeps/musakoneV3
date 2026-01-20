// WebSocket service for backend communication
import type { BackendMessage } from '../types';
import { setConnectionStatus } from '../stores/connection';
import { updatePlaybackState } from '../stores/player';
import { setQueue } from '../stores/queue';

class BackendWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private url: string;

  constructor() {
    // Default to localhost, can be configured via env
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_BACKEND_HOST || window.location.hostname;
    const port = import.meta.env.VITE_BACKEND_PORT || '3001';
    this.url = `${protocol}//${host}:${port}/ws`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to backend:', this.url);
    setConnectionStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        this.reconnectDelay = 1000; // Reset reconnect delay on successful connection
        
        // Request initial state
        this.send({ type: 'get_state' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: BackendMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error', 'Connection error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        setConnectionStatus('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error', 'Failed to connect');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return; // Already scheduled
    }

    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private handleMessage(message: BackendMessage): void {
    console.log('Received message:', message);

    // Handle Mopidy events forwarded from backend
    if (message.event) {
      this.handleMopidyEvent(message.event, message);
    }

    // Handle method responses
    if (message.result !== undefined) {
      this.handleResult(message);
    }

    // Handle errors
    if (message.error) {
      console.error('Backend error:', message.error);
    }
  }

  private handleMopidyEvent(event: string, message: BackendMessage): void {
    switch (event) {
      case 'track_playback_started':
        if (message.data && typeof message.data === 'object' && 'tl_track' in message.data) {
          const tlTrack = message.data.tl_track as { track: unknown };
          updatePlaybackState({
            state: 'playing',
            currentTrack: tlTrack.track as any,
          });
        }
        break;

      case 'track_playback_paused':
        updatePlaybackState({ state: 'paused' });
        break;

      case 'track_playback_resumed':
        updatePlaybackState({ state: 'playing' });
        break;

      case 'playback_state_changed':
        if (message.data && typeof message.data === 'object' && 'new_state' in message.data) {
          const newState = message.data.new_state as string;
          if (newState === 'playing' || newState === 'paused' || newState === 'stopped') {
            updatePlaybackState({ state: newState });
          }
        }
        break;

      case 'tracklist_changed':
        // Request updated queue
        this.send({ type: 'get_queue' });
        break;

      case 'volume_changed':
        if (message.data && typeof message.data === 'object' && 'volume' in message.data) {
          updatePlaybackState({ volume: message.data.volume as number });
        }
        break;

      default:
        console.log('Unhandled event:', event);
    }
  }

  private handleResult(message: BackendMessage): void {
    // Handle specific result types based on method or context
    if (Array.isArray(message.result)) {
      // Likely a queue response
      setQueue(message.result as any);
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send:', data);
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    setConnectionStatus('disconnected');
  }

  // Player control methods
  play(): void {
    this.send({ type: 'play' });
  }

  pause(): void {
    this.send({ type: 'pause' });
  }

  next(): void {
    this.send({ type: 'next' });
  }

  previous(): void {
    this.send({ type: 'previous' });
  }

  setVolume(volume: number): void {
    this.send({ type: 'set_volume', volume });
  }

  seek(position: number): void {
    this.send({ type: 'seek', position });
  }
}

// Singleton instance
export const backendWS = new BackendWebSocket();
