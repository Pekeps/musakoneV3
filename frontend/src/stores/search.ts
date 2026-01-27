/**
 * Search state management
 */

import { atom } from 'nanostores';
import type { Album, Artist, Track } from '../types';

// Search query
export const searchQuery = atom<string>('');

// Search results
export const searchTracks = atom<Track[]>([]);
export const searchArtists = atom<Artist[]>([]);
export const searchAlbums = atom<Album[]>([]);

// Loading state
export const searchLoading = atom<boolean>(false);

// Error state
export const searchError = atom<string | null>(null);

// Active tab
export const searchTab = atom<'tracks' | 'artists' | 'albums'>('tracks');

// Actions
export function setSearchQuery(query: string): void {
    searchQuery.set(query);
}

export function setSearchResults(tracks: Track[], artists: Artist[], albums: Album[]): void {
    searchTracks.set(tracks);
    searchArtists.set(artists);
    searchAlbums.set(albums);
    searchError.set(null);
}

export function setSearchLoading(loading: boolean): void {
    searchLoading.set(loading);
}

export function setSearchError(error: string | null): void {
    searchError.set(error);
}

export function setSearchTab(tab: 'tracks' | 'artists' | 'albums'): void {
    searchTab.set(tab);
}

export function clearSearch(): void {
    searchQuery.set('');
    searchTracks.set([]);
    searchArtists.set([]);
    searchAlbums.set([]);
    searchError.set(null);
}
