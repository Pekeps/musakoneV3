import { useStore } from '@nanostores/preact';
import { Check, ChevronRight, Disc, Music, Plus, Search, User, X } from 'lucide-preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'wouter';
import * as mopidy from '../services/mopidy';
import { connectionStatus } from '../stores/connection';
import { navigateTo, resetLibrary } from '../stores/library';
import { queue } from '../stores/queue';
import {
    clearSearch,
    searchAlbums,
    searchArtists,
    searchError,
    searchLoading,
    searchQuery,
    searchTab,
    searchTracks,
    setSearchError,
    setSearchLoading,
    setSearchQuery,
    setSearchResults,
    setSearchTab,
} from '../stores/search';
import type { Album, Artist, Track } from '../types';
import styles from './SearchView.module.css';

export function SearchView() {
    const query = useStore(searchQuery);
    const tracks = useStore(searchTracks);
    const artists = useStore(searchArtists);
    const albums = useStore(searchAlbums);
    const loading = useStore(searchLoading);
    const error = useStore(searchError);
    const tab = useStore(searchTab);
    const queueTracks = useStore(queue);
    const connStatus = useStore(connectionStatus);
    const [inputValue, setInputValue] = useState(query);
    const [, setLocation] = useLocation();
    const hasInitialized = useRef(false);
    const pendingSearch = useRef<string | null>(null);

    // Update URL when search query or tab changes
    const updateUrl = useCallback((searchQuery: string, currentTab: string) => {
        const params = new URLSearchParams();
        if (searchQuery) {
            params.set('q', searchQuery);
            params.set('tab', currentTab);
        }
        const search = params.toString();
        const newUrl = search ? `/search?${search}` : '/search';
        window.history.replaceState(null, '', newUrl);
    }, []);

    // Create a set of URIs already in queue for quick lookup
    const queuedUris = useMemo(() => {
        return new Set(queueTracks.map((t) => t.track.uri));
    }, [queueTracks]);

    const handleSearch = useCallback(
        async (searchValue: string) => {
            const trimmed = searchValue.trim();
            if (!trimmed) {
                clearSearch();
                updateUrl('', tab);
                return;
            }

            setSearchQuery(trimmed);
            setSearchLoading(true);
            setSearchError(null);
            updateUrl(trimmed, tab);

            try {
                const results = await mopidy.search(trimmed);
                setSearchResults(results.tracks, results.artists, results.albums);
            } catch (err) {
                console.error('Search failed:', err);
                setSearchError(err instanceof Error ? err.message : 'Search failed');
            } finally {
                setSearchLoading(false);
            }
        },
        [tab, updateUrl]
    );

    // Read search params from URL on mount
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const params = new URLSearchParams(window.location.search);
        const urlQuery = params.get('q');
        const urlTab = params.get('tab') as 'tracks' | 'artists' | 'albums' | null;

        if (urlTab && ['tracks', 'artists', 'albums'].includes(urlTab)) {
            setSearchTab(urlTab);
        }

        if (urlQuery) {
            setInputValue(urlQuery);
            // Store the query to search once connected
            pendingSearch.current = urlQuery;
        }
    }, []);

    // Trigger pending search once connected
    useEffect(() => {
        if (connStatus === 'connected' && pendingSearch.current) {
            const queryToSearch = pendingSearch.current;
            pendingSearch.current = null;
            handleSearch(queryToSearch);
        }
    }, [connStatus, handleSearch]);

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        handleSearch(inputValue);
    };

    const handleClear = () => {
        setInputValue('');
        clearSearch();
        updateUrl('', tab);
    };

    const handleAddTrack = async (track: Track) => {
        try {
            await mopidy.addToTracklist([track.uri]);
        } catch (err) {
            console.error('Failed to add track:', err);
        }
    };

    const handleAddTrackNext = async (track: Track) => {
        try {
            const queue = await mopidy.getTracklist();
            const currentTlid = await mopidy.getCurrentTlid();
            let insertPosition = 0;

            if (currentTlid) {
                const currentIndex = queue.findIndex((t) => t.tlid === currentTlid);
                if (currentIndex !== -1) {
                    insertPosition = currentIndex + 1;
                }
            }

            await mopidy.addToTracklist([track.uri], insertPosition);
        } catch (err) {
            console.error('Failed to add track next:', err);
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

    const handleArtistClick = (artist: Artist) => {
        resetLibrary();
        navigateTo(artist.uri, artist.name);
        setLocation('/library');
    };

    const handleAlbumClick = (album: Album) => {
        resetLibrary();
        navigateTo(album.uri, album.name);
        setLocation('/library');
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
                        onClick={() => {
                            setSearchTab('tracks');
                            updateUrl(query, 'tracks');
                        }}
                    >
                        <Music size={16} />
                        Tracks ({tracks.length})
                    </button>
                    <button
                        className={`${styles.tab} ${tab === 'artists' ? styles.active : ''}`}
                        onClick={() => {
                            setSearchTab('artists');
                            updateUrl(query, 'artists');
                        }}
                    >
                        <User size={16} />
                        Artists ({artists.length})
                    </button>
                    <button
                        className={`${styles.tab} ${tab === 'albums' ? styles.active : ''}`}
                        onClick={() => {
                            setSearchTab('albums');
                            updateUrl(query, 'albums');
                        }}
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
                        <TrackList
                            tracks={tracks}
                            onAdd={handleAddTrack}
                            onAddNext={handleAddTrackNext}
                            queuedUris={queuedUris}
                        />
                    )}
                    {tab === 'artists' && (
                        <ArtistList
                            artists={artists}
                            onAdd={handleAddArtist}
                            onClick={handleArtistClick}
                        />
                    )}
                    {tab === 'albums' && (
                        <AlbumList
                            albums={albums}
                            onAdd={handleAddAlbum}
                            onClick={handleAlbumClick}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

interface TrackListProps {
    tracks: Track[];
    onAdd: (track: Track) => void;
    onAddNext: (track: Track) => void;
    queuedUris: Set<string>;
}

function TrackList({ tracks, onAdd, onAddNext, queuedUris }: TrackListProps) {
    return (
        <div className={styles.list}>
            {tracks.map((track) => (
                <SwipeableTrackItem
                    key={track.uri}
                    track={track}
                    isQueued={queuedUris.has(track.uri)}
                    onAdd={onAdd}
                    onAddNext={onAddNext}
                />
            ))}
        </div>
    );
}

interface SwipeableTrackItemProps {
    track: Track;
    isQueued: boolean;
    onAdd: (track: Track) => void;
    onAddNext: (track: Track) => void;
}

function SwipeableTrackItem({ track, isQueued, onAdd, onAddNext }: SwipeableTrackItemProps) {
    const [swipeX, setSwipeX] = useState(0);
    const [swiping, setSwiping] = useState(false);
    const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
    const startX = useRef(0);
    const threshold = 160;

    const handleTouchStart = (e: TouchEvent) => {
        if (isQueued || animating) return;
        startX.current = e.touches[0]?.clientX || 0;
        setSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!swiping || isQueued || animating) return;
        const diff = (e.touches[0]?.clientX || 0) - startX.current;
        setSwipeX(Math.max(-150, Math.min(150, diff)));
    };

    const handleTouchEnd = () => {
        if (!swiping || isQueued || animating) return;
        setSwiping(false);

        if (swipeX < -threshold) {
            // Animate off to the left, then add next
            setAnimating('left');
            setTimeout(() => {
                onAddNext(track);
                setTimeout(() => {
                    setSwipeX(0);
                    setAnimating(null);
                }, 150);
            }, 200);
        } else if (swipeX > threshold) {
            // Animate off to the right, then add to end
            setAnimating('right');
            setTimeout(() => {
                onAdd(track);
                setTimeout(() => {
                    setSwipeX(0);
                    setAnimating(null);
                }, 150);
            }, 200);
        } else {
            setSwipeX(0);
        }
    };

    const getSwipeIndicator = () => {
        if (animating === 'left') return styles.swipeNextActive;
        if (animating === 'right') return styles.swipeAddActive;
        if (swipeX < -threshold) return styles.swipeNextActive;
        if (swipeX > threshold) return styles.swipeAddActive;
        if (swipeX < -20) return styles.swipeNext;
        if (swipeX > 20) return styles.swipeAdd;
        return '';
    };

    const getTransform = () => {
        if (animating === 'left') return 'translateX(-100%)';
        if (animating === 'right') return 'translateX(100%)';
        return `translateX(${swipeX}px)`;
    };

    return (
        <div className={`${styles.trackWrapper} ${getSwipeIndicator()}`}>
            <div className={styles.swipeHint + ' ' + styles.swipeHintLeft}>+ Queue Next</div>
            <div className={styles.swipeHint + ' ' + styles.swipeHintRight}>+ Queue to End</div>
            <div
                className={`${styles.item} ${animating ? styles.itemAnimating : ''}`}
                style={{ transform: getTransform() }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
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
                <div className={styles.itemDuration}>{formatDuration(track.duration)}</div>
                {isQueued ? (
                    <div className={styles.inQueue} title="Already in queue">
                        <Check size={18} />
                    </div>
                ) : (
                    <button
                        className={styles.addBtn}
                        onClick={() => onAdd(track)}
                        aria-label={`Add ${track.name} to queue`}
                        title="Add to queue"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}

interface ArtistListProps {
    artists: Artist[];
    onAdd: (artist: Artist) => void;
    onClick: (artist: Artist) => void;
}

function ArtistList({ artists, onAdd, onClick }: ArtistListProps) {
    const handleAdd = (artist: Artist, e: Event) => {
        e.stopPropagation();
        onAdd(artist);
    };

    return (
        <div className={styles.list}>
            {artists.map((artist) => (
                <div
                    key={artist.uri}
                    className={`${styles.item} ${styles.clickable}`}
                    onClick={() => onClick(artist)}
                >
                    <div className={`${styles.itemIcon} ${styles.artistIcon}`}>
                        <User size={20} />
                    </div>
                    <div className={styles.itemInfo}>
                        <div className={styles.itemName}>{artist.name}</div>
                        <div className={styles.itemMeta}>Artist</div>
                    </div>
                    <button
                        className={styles.addBtn}
                        onClick={(e) => handleAdd(artist, e)}
                        aria-label={`Add all ${artist.name} tracks to queue`}
                    >
                        <Plus size={18} />
                    </button>
                    <ChevronRight size={18} className={styles.chevron} />
                </div>
            ))}
        </div>
    );
}

interface AlbumListProps {
    albums: Album[];
    onAdd: (album: Album) => void;
    onClick: (album: Album) => void;
}

function AlbumList({ albums, onAdd, onClick }: AlbumListProps) {
    const handleAdd = (album: Album, e: Event) => {
        e.stopPropagation();
        onAdd(album);
    };

    return (
        <div className={styles.list}>
            {albums.map((album) => (
                <div
                    key={album.uri}
                    className={`${styles.item} ${styles.clickable}`}
                    onClick={() => onClick(album)}
                >
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
                        onClick={(e) => handleAdd(album, e)}
                        aria-label={`Add ${album.name} to queue`}
                    >
                        <Plus size={18} />
                    </button>
                    <ChevronRight size={18} className={styles.chevron} />
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
