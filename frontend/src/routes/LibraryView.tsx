import { useStore } from '@nanostores/preact';
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-preact';
import { useEffect, useMemo } from 'preact/hooks';
import { SwipeableItem } from '../components/SwipeableItem';
import { useAddToQueue } from '../hooks/useAddToQueue';
import type { LibraryRef } from '../services/mopidy';
import * as mopidy from '../services/mopidy';
import {
    currentUri,
    libraryError,
    libraryItems,
    libraryLoading,
    libraryPath,
    navigateBack,
    navigateTo,
    navigateToIndex,
    setLibraryError,
    setLibraryItems,
    setLibraryLoading,
} from '../stores/library';
import { queue } from '../stores/queue';
import { getLibraryIcon } from '../utils/icons';
import styles from './LibraryView.module.css';

export function LibraryView() {
    const items = useStore(libraryItems);
    const path = useStore(libraryPath);
    const loading = useStore(libraryLoading);
    const error = useStore(libraryError);
    const uri = useStore(currentUri);
    const queueTracks = useStore(queue);
    const { addToQueue, addNext } = useAddToQueue();

    // Create a set of URIs already in queue for quick lookup
    const queuedUris = useMemo(() => {
        return new Set(queueTracks.map((t) => t.track.uri));
    }, [queueTracks]);

    const loadLibrary = async (browseUri: string | null) => {
        setLibraryLoading(true);
        setLibraryError(null);
        try {
            const refs = await mopidy.browse(browseUri || undefined);
            setLibraryItems(refs);
        } catch (err) {
            console.error('Failed to browse library:', err);
            setLibraryError(err instanceof Error ? err.message : 'Failed to load library');
        } finally {
            setLibraryLoading(false);
        }
    };

    useEffect(() => {
        loadLibrary(uri);
    }, [uri]);

    const handleItemClick = async (item: LibraryRef) => {
        // Prevent navigation while loading
        if (loading) return;

        // Only navigate for non-track items
        if (item.type !== 'track') {
            navigateTo(item.uri, item.name);
        }
    };

    const handleAddToQueue = async (item: LibraryRef, e: Event) => {
        e.stopPropagation();
        try {
            if (item.type === 'track') {
                await addToQueue(item.uri);
            } else {
                // For directories/albums, lookup all tracks and add them
                const tracksMap = await mopidy.lookup([item.uri]);
                const tracks = tracksMap.get(item.uri) || [];
                if (tracks.length > 0) {
                    await addToQueue(tracks.map((t) => t.uri));
                }
            }
        } catch (err) {
            console.error('Failed to add to queue:', err);
        }
    };

    const handleAddNext = async (item: LibraryRef, e: Event) => {
        e.stopPropagation();
        try {
            if (item.type === 'track') {
                await addNext(item.uri);
            } else {
                const tracksMap = await mopidy.lookup([item.uri]);
                const tracks = tracksMap.get(item.uri) || [];
                if (tracks.length > 0) {
                    await addNext(tracks.map((t) => t.uri));
                }
            }
        } catch (err) {
            console.error('Failed to add next:', err);
        }
    };

    return (
        <div className={styles.container}>
            {/* Breadcrumb navigation */}
            <div className={styles.breadcrumbs}>
                {path.length > 1 && (
                    <button
                        className={styles.backBtn}
                        onClick={navigateBack}
                        disabled={loading}
                        aria-label="Go back"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <div className={styles.breadcrumbList}>
                    {path.map((crumb, index) => (
                        <button
                            key={index}
                            className={`${styles.breadcrumb} ${index === path.length - 1 ? styles.active : ''}`}
                            onClick={() => navigateToIndex(index)}
                            disabled={loading || index === path.length - 1}
                        >
                            {crumb.name}
                            {index < path.length - 1 && (
                                <ChevronRight size={14} className={styles.separator} />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading && items.length === 0 ? (
                <div className={styles.loading}>Loading...</div>
            ) : error ? (
                <div className={styles.error}>
                    <p>{error}</p>
                    <button className={styles.retryBtn} onClick={() => loadLibrary(uri)}>
                        Retry
                    </button>
                </div>
            ) : items.length === 0 ? (
                <div className={styles.empty}>
                    <p>No items found</p>
                </div>
            ) : (
                <div className={`${styles.list} ${loading ? styles.listLoading : ''}`}>
                    {items.map((item) =>
                        item.type === 'track' ? (
                            <SwipeableLibraryItem
                                key={item.uri}
                                item={item}
                                isQueued={queuedUris.has(item.uri)}
                                disabled={loading}
                                onAdd={handleAddToQueue}
                                onAddNext={handleAddNext}
                            />
                        ) : (
                            <div
                                key={item.uri}
                                className={`${styles.item} ${styles[item.type]} ${loading ? styles.itemDisabled : ''}`}
                                onClick={() => handleItemClick(item)}
                            >
                                <div className={styles.icon}>{getLibraryIcon(item.type)}</div>
                                <div className={styles.info}>
                                    <div className={styles.name}>{item.name}</div>
                                    <div className={styles.type}>{item.type}</div>
                                </div>
                                {item.type !== 'directory' && (
                                    <button
                                        className={styles.addBtn}
                                        onClick={(e) => handleAddToQueue(item, e)}
                                        aria-label={`Add ${item.name} to queue`}
                                        title="Add to queue"
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                                <ChevronRight size={18} className={styles.chevron} />
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

interface SwipeableLibraryItemProps {
    item: LibraryRef;
    isQueued: boolean;
    disabled: boolean;
    onAdd: (item: LibraryRef, e: Event) => void;
    onAddNext: (item: LibraryRef, e: Event) => void;
}

function SwipeableLibraryItem({
    item,
    isQueued,
    disabled,
    onAdd,
    onAddNext,
}: SwipeableLibraryItemProps) {
    // Create dummy event for swipe callbacks
    const dummyEvent = new Event('swipe');

    return (
        <SwipeableItem
            isDisabled={isQueued || disabled}
            onSwipeLeft={() => onAddNext(item, dummyEvent)}
            onSwipeRight={() => onAdd(item, dummyEvent)}
            leftLabel="+ Add Next"
            rightLabel="+ Add to End"
            threshold={80}
            className={`${styles.item} ${styles.track} ${disabled ? styles.itemDisabled : ''}`}
        >
            <>
                <div className={styles.icon}>{getLibraryIcon(item.type)}</div>
                <div className={styles.info}>
                    <div className={styles.name}>{item.name}</div>
                    <div className={styles.type}>{item.type}</div>
                </div>
                {isQueued ? (
                    <div className={styles.inQueue} title="Already in queue">
                        <Check size={18} />
                    </div>
                ) : (
                    <button
                        className={styles.addBtn}
                        onClick={(e) => onAdd(item, e)}
                        aria-label={`Add ${item.name} to queue`}
                        title="Add to queue"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </>
        </SwipeableItem>
    );
}
