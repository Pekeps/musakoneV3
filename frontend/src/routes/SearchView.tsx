import { useState, useCallback } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { Search, Plus, Music, User, Disc, X } from 'lucide-preact';
import {
  searchQuery,
  searchTracks,
  searchArtists,
  searchAlbums,
  searchLoading,
  searchError,
  searchTab,
  setSearchQuery,
  setSearchResults,
  setSearchLoading,
  setSearchError,
  setSearchTab,
  clearSearch,
} from '../stores/search';
import * as mopidy from '../services/mopidy';
import type { Track, Artist, Album } from '../types';
import styles from './SearchView.module.css';

export function SearchView() {
  const query = useStore(searchQuery);
  const tracks = useStore(searchTracks);
  const artists = useStore(searchArtists);
  const albums = useStore(searchAlbums);
  const loading = useStore(searchLoading);
  const error = useStore(searchError);
  const tab = useStore(searchTab);
  const [inputValue, setInputValue] = useState(query);

  const handleSearch = useCallback(async (searchValue: string) => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      clearSearch();
      return;
    }

    setSearchQuery(trimmed);
    setSearchLoading(true);
    setSearchError(null);

    try {
      const results = await mopidy.search(trimmed);
      setSearchResults(results.tracks, results.artists, results.albums);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    handleSearch(inputValue);
  };

  const handleClear = () => {
    setInputValue('');
    clearSearch();
  };

  const handleAddTrack = async (track: Track) => {
    try {
      await mopidy.addToTracklist([track.uri]);
    } catch (err) {
      console.error('Failed to add track:', err);
    }
  };

  const handleAddArtist = async (artist: Artist) => {
    try {
      const tracksMap = await mopidy.lookup([artist.uri]);
      const artistTracks = tracksMap.get(artist.uri) || [];
      if (artistTracks.length > 0) {
        await mopidy.addToTracklist(artistTracks.map((t) => t.uri));
      }
    } catch (err) {
      console.error('Failed to add artist tracks:', err);
    }
  };

  const handleAddAlbum = async (album: Album) => {
    try {
      const tracksMap = await mopidy.lookup([album.uri]);
      const albumTracks = tracksMap.get(album.uri) || [];
      if (albumTracks.length > 0) {
        await mopidy.addToTracklist(albumTracks.map((t) => t.uri));
      }
    } catch (err) {
      console.error('Failed to add album tracks:', err);
    }
  };

  const hasResults = tracks.length > 0 || artists.length > 0 || albums.length > 0;

  return (
    <div className={styles.container}>
      {/* Search input */}
      <form className={styles.searchForm} onSubmit={handleSubmit}>
        <div className={styles.inputWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.input}
            placeholder="Search music..."
            value={inputValue}
            onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {inputValue && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Tabs */}
      {hasResults && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'tracks' ? styles.active : ''}`}
            onClick={() => setSearchTab('tracks')}
          >
            <Music size={16} />
            Tracks ({tracks.length})
          </button>
          <button
            className={`${styles.tab} ${tab === 'artists' ? styles.active : ''}`}
            onClick={() => setSearchTab('artists')}
          >
            <User size={16} />
            Artists ({artists.length})
          </button>
          <button
            className={`${styles.tab} ${tab === 'albums' ? styles.active : ''}`}
            onClick={() => setSearchTab('albums')}
          >
            <Disc size={16} />
            Albums ({albums.length})
          </button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className={styles.loading}>Searching...</div>
      ) : error ? (
        <div className={styles.error}>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={() => handleSearch(query)}>
            Retry
          </button>
        </div>
      ) : !query ? (
        <div className={styles.placeholder}>
          <Search size={48} className={styles.placeholderIcon} />
          <p>Search for tracks, artists, or albums</p>
        </div>
      ) : !hasResults ? (
        <div className={styles.empty}>
          <p>No results found for "{query}"</p>
        </div>
      ) : (
        <div className={styles.results}>
          {tab === 'tracks' && (
            <TrackList tracks={tracks} onAdd={handleAddTrack} />
          )}
          {tab === 'artists' && (
            <ArtistList artists={artists} onAdd={handleAddArtist} />
          )}
          {tab === 'albums' && (
            <AlbumList albums={albums} onAdd={handleAddAlbum} />
          )}
        </div>
      )}
    </div>
  );
}

interface TrackListProps {
  tracks: Track[];
  onAdd: (track: Track) => void;
}

function TrackList({ tracks, onAdd }: TrackListProps) {
  return (
    <div className={styles.list}>
      {tracks.map((track) => (
        <div key={track.uri} className={styles.item}>
          <div className={styles.itemIcon}>
            <Music size={20} />
          </div>
          <div className={styles.itemInfo}>
            <div className={styles.itemName}>{track.name}</div>
            <div className={styles.itemMeta}>
              {track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
              {track.album && ` • ${track.album.name}`}
            </div>
          </div>
          <div className={styles.itemDuration}>
            {formatDuration(track.duration)}
          </div>
          <button
            className={styles.addBtn}
            onClick={() => onAdd(track)}
            aria-label={`Add ${track.name} to queue`}
          >
            <Plus size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

interface ArtistListProps {
  artists: Artist[];
  onAdd: (artist: Artist) => void;
}

function ArtistList({ artists, onAdd }: ArtistListProps) {
  return (
    <div className={styles.list}>
      {artists.map((artist) => (
        <div key={artist.uri} className={styles.item}>
          <div className={`${styles.itemIcon} ${styles.artistIcon}`}>
            <User size={20} />
          </div>
          <div className={styles.itemInfo}>
            <div className={styles.itemName}>{artist.name}</div>
            <div className={styles.itemMeta}>Artist</div>
          </div>
          <button
            className={styles.addBtn}
            onClick={() => onAdd(artist)}
            aria-label={`Add all ${artist.name} tracks to queue`}
          >
            <Plus size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

interface AlbumListProps {
  albums: Album[];
  onAdd: (album: Album) => void;
}

function AlbumList({ albums, onAdd }: AlbumListProps) {
  return (
    <div className={styles.list}>
      {albums.map((album) => (
        <div key={album.uri} className={styles.item}>
          <div className={`${styles.itemIcon} ${styles.albumIcon}`}>
            <Disc size={20} />
          </div>
          <div className={styles.itemInfo}>
            <div className={styles.itemName}>{album.name}</div>
            <div className={styles.itemMeta}>
              {album.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
            </div>
          </div>
          <button
            className={styles.addBtn}
            onClick={() => onAdd(album)}
            aria-label={`Add ${album.name} to queue`}
          >
            <Plus size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms) return '--:--';
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
