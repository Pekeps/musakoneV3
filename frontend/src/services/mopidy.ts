/**
 * Mopidy JSON-RPC client via Backend WebSocket
 * Connects to the backend which proxies to Mopidy
 */

import type { Track, QueueTrack, Artist, Album } from '../types';
import { updatePlaybackState } from '../stores/player';
import { setQueue } from '../stores/queue';
import { setConnectionStatus } from '../stores/connection';
import { getToken } from './auth';

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:3001/ws';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MopidyEvent {
  event: string;
  [key: string]: unknown;
}

interface MopidyRef {
  __model__: string;
  type: string;
  uri: string;
  name: string;
}

interface MopidyTrack {
  __model__: 'Track';
  uri: string;
  name: string;
  artists?: Array<{ __model__: 'Artist'; uri: string; name: string }>;
  album?: { __model__: 'Album'; uri: string; name: string; artists?: Array<{ uri: string; name: string }> };
  length?: number;
}

interface MopidyTlTrack {
  __model__: 'TlTrack';
  tlid: number;
  track: MopidyTrack;
}

interface MopidySearchResult {
  uri: string;
  tracks?: MopidyTrack[];
  artists?: Array<{ uri: string; name: string }>;
  albums?: Array<{ uri: string; name: string; artists?: Array<{ uri: string; name: string }> }>;
}

type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

class MopidyWebSocket {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest<unknown>>();
  private reconnectTimeout: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private url: string;
  private connected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(url: string = BACKEND_WS_URL) {
    this.url = url;
  }

  connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Build WebSocket URL with auth token
      const token = getToken();
      const wsUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url;

      console.log('Connecting to backend:', this.url);
      setConnectionStatus('connecting');

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Backend WebSocket connected');
          this.connected = true;
          this.reconnectDelay = 1000;
          this.connectionPromise = null;
          setConnectionStatus('connected');
          resolve();

          // Load initial state after connection
          this.loadInitialState();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Backend WebSocket error:', error);
          setConnectionStatus('error', 'Connection error');
        };

        this.ws.onclose = () => {
          console.log('Backend WebSocket closed');
          this.connected = false;
          this.connectionPromise = null;
          setConnectionStatus('disconnected');
          this.rejectAllPending();
          this.scheduleReconnect();
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.connectionPromise = null;
        setConnectionStatus('error', 'Failed to connect');
        reject(error);
        this.scheduleReconnect();
      }
    });

    return this.connectionPromise;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private rejectAllPending(): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('WebSocket disconnected'));
    }
    this.pendingRequests.clear();
  }

  private handleMessage(message: JsonRpcResponse | MopidyEvent): void {
    // Handle JSON-RPC response
    if ('id' in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Handle Mopidy event (forwarded from backend)
    if ('event' in message) {
      this.handleEvent(message as MopidyEvent);
    }
  }

  private handleEvent(event: MopidyEvent): void {
    console.log('Mopidy event:', event.event, event);

    switch (event.event) {
      case 'track_playback_started':
        if (event.tl_track) {
          const tlTrack = event.tl_track as MopidyTlTrack;
          updatePlaybackState({
            state: 'playing',
            currentTrack: convertTrack(tlTrack.track),
            timePosition: 0,
          });
        }
        break;

      case 'track_playback_paused':
        updatePlaybackState({ state: 'paused' });
        if (event.time_position !== undefined) {
          updatePlaybackState({ timePosition: event.time_position as number });
        }
        break;

      case 'track_playback_resumed':
        updatePlaybackState({ state: 'playing' });
        if (event.time_position !== undefined) {
          updatePlaybackState({ timePosition: event.time_position as number });
        }
        break;

      case 'track_playback_ended':
        // Track ended, wait for next track or update to stopped
        break;

      case 'playback_state_changed':
        const newState = event.new_state as string;
        if (newState === 'playing' || newState === 'paused' || newState === 'stopped') {
          updatePlaybackState({ state: newState });
        }
        break;

      case 'tracklist_changed':
        // Refresh queue
        this.getTracklist().then((tracks) => {
          setQueue(tracks);
        }).catch(console.error);
        break;

      case 'volume_changed':
        if (event.volume !== undefined) {
          updatePlaybackState({ volume: event.volume as number });
        }
        break;

      case 'seeked':
        if (event.time_position !== undefined) {
          updatePlaybackState({ timePosition: event.time_position as number });
        }
        break;

      default:
        console.log('Unhandled event:', event.event);
    }
  }

  private async loadInitialState(): Promise<void> {
    try {
      const [state, tlTrack, timePosition, volume, tracklist] = await Promise.all([
        this.rpc<string>('core.playback.get_state'),
        this.rpc<MopidyTlTrack | null>('core.playback.get_current_tl_track'),
        this.rpc<number>('core.playback.get_time_position'),
        this.rpc<number>('core.mixer.get_volume'),
        this.rpc<MopidyTlTrack[]>('core.tracklist.get_tl_tracks'),
      ]);

      updatePlaybackState({
        state: state as 'playing' | 'paused' | 'stopped',
        currentTrack: tlTrack ? convertTrack(tlTrack.track) : null,
        timePosition: timePosition || 0,
        volume: volume || 80,
      });

      setQueue(tracklist.map(convertTlTrack));
    } catch (err) {
      console.error('Failed to load initial state:', err);
    }
  }

  async rpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    await this.connect();

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params: params || {},
      };

      // Set timeout for request
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 10000);

      this.pendingRequests.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws.send(JSON.stringify(request));
    });
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
    this.connected = false;
    this.rejectAllPending();
    setConnectionStatus('disconnected');
  }

  // Playback control methods
  async play(tlid?: number): Promise<void> {
    if (tlid !== undefined) {
      await this.rpc('core.playback.play', { tlid });
    } else {
      await this.rpc('core.playback.play');
    }
  }

  async pause(): Promise<void> {
    await this.rpc('core.playback.pause');
  }

  async resume(): Promise<void> {
    await this.rpc('core.playback.resume');
  }

  async stop(): Promise<void> {
    await this.rpc('core.playback.stop');
  }

  async next(): Promise<void> {
    await this.rpc('core.playback.next');
  }

  async previous(): Promise<void> {
    await this.rpc('core.playback.previous');
  }

  async seek(timePosition: number): Promise<boolean> {
    return this.rpc<boolean>('core.playback.seek', { time_position: timePosition });
  }

  async getState(): Promise<'playing' | 'paused' | 'stopped'> {
    return this.rpc<'playing' | 'paused' | 'stopped'>('core.playback.get_state');
  }

  async getCurrentTrack(): Promise<Track | null> {
    const tlTrack = await this.rpc<MopidyTlTrack | null>('core.playback.get_current_tl_track');
    return tlTrack ? convertTrack(tlTrack.track) : null;
  }

  async getTimePosition(): Promise<number> {
    return (await this.rpc<number>('core.playback.get_time_position')) || 0;
  }

  // Volume control
  async getVolume(): Promise<number> {
    return (await this.rpc<number>('core.mixer.get_volume')) || 0;
  }

  async setVolume(volume: number): Promise<boolean> {
    return this.rpc<boolean>('core.mixer.set_volume', { volume: Math.max(0, Math.min(100, volume)) });
  }

  // Tracklist (Queue) management
  async getTracklist(): Promise<QueueTrack[]> {
    const tlTracks = await this.rpc<MopidyTlTrack[]>('core.tracklist.get_tl_tracks');
    return tlTracks.map(convertTlTrack);
  }

  async addToTracklist(uris: string[], atPosition?: number): Promise<QueueTrack[]> {
    const params: Record<string, unknown> = { uris };
    if (atPosition !== undefined) {
      params.at_position = atPosition;
    }
    const tlTracks = await this.rpc<MopidyTlTrack[]>('core.tracklist.add', params);
    return tlTracks.map(convertTlTrack);
  }

  async removeFromTracklist(tlids: number[]): Promise<void> {
    await this.rpc('core.tracklist.remove', { criteria: { tlid: tlids } });
  }

  async clearTracklist(): Promise<void> {
    await this.rpc('core.tracklist.clear');
  }

  async shuffleTracklist(): Promise<void> {
    await this.rpc('core.tracklist.shuffle');
  }

  async getCurrentTlid(): Promise<number | null> {
    const tlTrack = await this.rpc<MopidyTlTrack | null>('core.playback.get_current_tl_track');
    return tlTrack?.tlid || null;
  }

  // Library browsing
  async browse(uri?: string): Promise<LibraryRef[]> {
    const refs = await this.rpc<MopidyRef[]>('core.library.browse', { uri: uri || null });
    return refs.map((ref) => ({
      type: ref.type as LibraryRef['type'],
      uri: ref.uri,
      name: ref.name,
    }));
  }

  async lookup(uris: string[]): Promise<Map<string, Track[]>> {
    const result = await this.rpc<Record<string, MopidyTrack[]>>('core.library.lookup', { uris });
    const map = new Map<string, Track[]>();
    for (const [uri, tracks] of Object.entries(result)) {
      map.set(uri, tracks.map(convertTrack));
    }
    return map;
  }

  // Search
  async search(query: string): Promise<SearchResult> {
    const results = await this.rpc<MopidySearchResult[]>('core.library.search', {
      query: { any: [query] },
      exact: false,
    });

    const tracks: Track[] = [];
    const artists: Artist[] = [];
    const albums: Album[] = [];
    const seenArtists = new Set<string>();
    const seenAlbums = new Set<string>();

    for (const result of results) {
      if (result.tracks) {
        tracks.push(...result.tracks.map(convertTrack));
      }
      if (result.artists) {
        for (const artist of result.artists) {
          if (!seenArtists.has(artist.uri)) {
            seenArtists.add(artist.uri);
            artists.push({ uri: artist.uri, name: artist.name });
          }
        }
      }
      if (result.albums) {
        for (const album of result.albums) {
          if (!seenAlbums.has(album.uri)) {
            seenAlbums.add(album.uri);
            albums.push({
              uri: album.uri,
              name: album.name,
              artists: album.artists?.map((a) => ({ uri: a.uri, name: a.name })),
            });
          }
        }
      }
    }

    return { tracks, artists, albums };
  }

  // Get full playback state
  async getFullState(): Promise<FullPlaybackState> {
    const [state, currentTlTrack, timePosition, volume, repeat, single, random] = await Promise.all([
      this.getState(),
      this.rpc<MopidyTlTrack | null>('core.playback.get_current_tl_track'),
      this.getTimePosition(),
      this.getVolume(),
      this.rpc<boolean>('core.tracklist.get_repeat'),
      this.rpc<boolean>('core.tracklist.get_single'),
      this.rpc<boolean>('core.tracklist.get_random'),
    ]);

    return {
      state,
      currentTrack: currentTlTrack ? convertTrack(currentTlTrack.track) : null,
      currentTlid: currentTlTrack?.tlid || null,
      timePosition,
      volume,
      repeat,
      single,
      random,
    };
  }
}

// Helper functions
function convertTrack(mopidyTrack: MopidyTrack): Track {
  return {
    uri: mopidyTrack.uri,
    name: mopidyTrack.name,
    artists: mopidyTrack.artists?.map((a) => ({ uri: a.uri, name: a.name })),
    album: mopidyTrack.album
      ? {
          uri: mopidyTrack.album.uri,
          name: mopidyTrack.album.name,
          artists: mopidyTrack.album.artists?.map((a) => ({ uri: a.uri, name: a.name })),
        }
      : undefined,
    duration: mopidyTrack.length || 0,
  };
}

function convertTlTrack(tlTrack: MopidyTlTrack): QueueTrack {
  return {
    tlid: tlTrack.tlid,
    track: convertTrack(tlTrack.track),
  };
}

// Types
export interface LibraryRef {
  type: 'artist' | 'album' | 'track' | 'directory' | 'playlist';
  uri: string;
  name: string;
}

export interface SearchResult {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
}

export interface FullPlaybackState {
  state: 'playing' | 'paused' | 'stopped';
  currentTrack: Track | null;
  currentTlid: number | null;
  timePosition: number;
  volume: number;
  repeat: boolean;
  single: boolean;
  random: boolean;
}

// Singleton instance
const mopidyClient = new MopidyWebSocket();

// Export functions that use the singleton
export const connect = () => mopidyClient.connect();
export const disconnect = () => mopidyClient.disconnect();
export const play = (tlid?: number) => mopidyClient.play(tlid);
export const pause = () => mopidyClient.pause();
export const resume = () => mopidyClient.resume();
export const stop = () => mopidyClient.stop();
export const next = () => mopidyClient.next();
export const previous = () => mopidyClient.previous();
export const seek = (pos: number) => mopidyClient.seek(pos);
export const getState = () => mopidyClient.getState();
export const getCurrentTrack = () => mopidyClient.getCurrentTrack();
export const getTimePosition = () => mopidyClient.getTimePosition();
export const getVolume = () => mopidyClient.getVolume();
export const setVolume = (vol: number) => mopidyClient.setVolume(vol);
export const getTracklist = () => mopidyClient.getTracklist();
export const addToTracklist = (uris: string[], pos?: number) => mopidyClient.addToTracklist(uris, pos);
export const removeFromTracklist = (tlids: number[]) => mopidyClient.removeFromTracklist(tlids);
export const clearTracklist = () => mopidyClient.clearTracklist();
export const shuffleTracklist = () => mopidyClient.shuffleTracklist();
export const getCurrentTlid = () => mopidyClient.getCurrentTlid();
export const browse = (uri?: string) => mopidyClient.browse(uri);
export const lookup = (uris: string[]) => mopidyClient.lookup(uris);
export const search = (query: string) => mopidyClient.search(query);
export const getFullState = () => mopidyClient.getFullState();

export default mopidyClient;
