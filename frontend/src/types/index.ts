// Core types for MusakoneV3

export interface Track {
    uri: string;
    name: string;
    artists?: Artist[];
    album?: Album;
    duration: number;
}

export interface Artist {
    uri: string;
    name: string;
}

export interface Album {
    uri: string;
    name: string;
    artists?: Artist[];
}

export interface PlaybackState {
    state: 'playing' | 'paused' | 'stopped';
    currentTrack: Track | null;
    timePosition: number;
    volume: number;
    repeat: 'off' | 'track' | 'all';
    random: boolean;
}

export interface QueueTrack {
    tlid: number;
    track: Track;
}

export interface WebSocketMessage {
    type: string;
    data?: unknown;
}

export interface BackendMessage {
    event?: string;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: {
        message: string;
        code?: number;
    };
}
