import { useEffect, useMemo, useState, useRef } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import type { JSX } from 'preact';
import { Plus, ChevronRight, ChevronLeft, Check } from 'lucide-preact';
import {
  libraryItems,
  libraryPath,
  libraryLoading,
  libraryError,
  currentUri,
  setLibraryItems,
  setLibraryLoading,
  setLibraryError,
  navigateTo,
  navigateBack,
  navigateToIndex,
} from '../stores/library';
import { queue } from '../stores/queue';
import * as mopidy from '../services/mopidy';
import { getLibraryIcon } from '../utils/icons';
import type { LibraryRef } from '../services/mopidy';
import styles from './LibraryView.module.css';

export function LibraryView() {
  const items = useStore(libraryItems);
  const path = useStore(libraryPath);
  const loading = useStore(libraryLoading);
  const error = useStore(libraryError);
  const uri = useStore(currentUri);
  const queueTracks = useStore(queue);

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
        await mopidy.addToTracklist([item.uri]);
      } else {
        // For directories/albums, lookup all tracks and add them
        const tracksMap = await mopidy.lookup([item.uri]);
        const tracks = tracksMap.get(item.uri) || [];
        if (tracks.length > 0) {
          await mopidy.addToTracklist(tracks.map((t) => t.uri));
        }
      }
    } catch (err) {
      console.error('Failed to add to queue:', err);
    }
  };

  const handleAddNext = async (item: LibraryRef, e: Event) => {
    e.stopPropagation();
    try {
      // Get current track position to insert after it
      const queue = await mopidy.getTracklist();
      const currentTlid = await mopidy.getCurrentTlid();
      let insertPosition = 0;

      if (currentTlid) {
        const currentIndex = queue.findIndex((t) => t.tlid === currentTlid);
        if (currentIndex !== -1) {
          insertPosition = currentIndex + 1;
        }
      }

      if (item.type === 'track') {
        await mopidy.addToTracklist([item.uri], insertPosition);
      } else {
        const tracksMap = await mopidy.lookup([item.uri]);
        const tracks = tracksMap.get(item.uri) || [];
        if (tracks.length > 0) {
          await mopidy.addToTracklist(tracks.map((t) => t.uri), insertPosition);
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
              {index < path.length - 1 && <ChevronRight size={14} className={styles.separator} />}
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
          {items.map((item) => (
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
          ))}
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

function SwipeableLibraryItem({ item, isQueued, disabled, onAdd, onAddNext }: SwipeableLibraryItemProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const threshold = 80;

  const handleTouchStart = (e: TouchEvent) => {
    if (isQueued || disabled || animating) return;
    startX.current = e.touches[0]?.clientX || 0;
    setSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!swiping || isQueued || disabled || animating) return;
    const diff = (e.touches[0]?.clientX || 0) - startX.current;
    setSwipeX(Math.max(-150, Math.min(150, diff)));
  };

  const handleTouchEnd = (e: Event) => {
    if (!swiping || isQueued || disabled || animating) return;
    setSwiping(false);

    if (swipeX < -threshold) {
      setAnimating('left');
      setTimeout(() => {
        onAddNext(item, e);
        setTimeout(() => {
          setSwipeX(0);
          setAnimating(null);
        }, 150);
      }, 200);
    } else if (swipeX > threshold) {
      setAnimating('right');
      setTimeout(() => {
        onAdd(item, e);
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
      <div className={styles.swipeHint + ' ' + styles.swipeHintLeft}>+ Add Next</div>
      <div className={styles.swipeHint + ' ' + styles.swipeHintRight}>+ Add to End</div>
      <div
        className={`${styles.item} ${styles.track} ${disabled ? styles.itemDisabled : ''} ${animating ? styles.itemAnimating : ''}`}
        style={{ transform: getTransform() }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
      </div>
    </div>
  );
}
