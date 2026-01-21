import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { Folder, Disc, User, Music, Plus, ChevronRight, ChevronLeft } from 'lucide-preact';
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
import * as mopidy from '../services/mopidy';
import type { LibraryRef } from '../services/mopidy';
import styles from './LibraryView.module.css';

export function LibraryView() {
  const items = useStore(libraryItems);
  const path = useStore(libraryPath);
  const loading = useStore(libraryLoading);
  const error = useStore(libraryError);
  const uri = useStore(currentUri);

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
    if (item.type === 'track') {
      // Add track to queue and play
      try {
        await mopidy.addToTracklist([item.uri]);
      } catch (err) {
        console.error('Failed to add track:', err);
      }
    } else {
      // Navigate into directory/artist/album
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

  const getIcon = (type: LibraryRef['type']) => {
    switch (type) {
      case 'directory':
        return <Folder size={20} />;
      case 'artist':
        return <User size={20} />;
      case 'album':
        return <Disc size={20} />;
      case 'track':
        return <Music size={20} />;
      case 'playlist':
        return <Folder size={20} />;
      default:
        return <Folder size={20} />;
    }
  };

  return (
    <div className={styles.container}>
      {/* Breadcrumb navigation */}
      <div className={styles.breadcrumbs}>
        {path.length > 1 && (
          <button className={styles.backBtn} onClick={navigateBack} aria-label="Go back">
            <ChevronLeft size={20} />
          </button>
        )}
        <div className={styles.breadcrumbList}>
          {path.map((crumb, index) => (
            <button
              key={index}
              className={`${styles.breadcrumb} ${index === path.length - 1 ? styles.active : ''}`}
              onClick={() => navigateToIndex(index)}
              disabled={index === path.length - 1}
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
        <div className={styles.list}>
          {items.map((item) => (
            <div
              key={item.uri}
              className={`${styles.item} ${styles[item.type]}`}
              onClick={() => handleItemClick(item)}
            >
              <div className={styles.icon}>{getIcon(item.type)}</div>
              <div className={styles.info}>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.type}>{item.type}</div>
              </div>
              <button
                className={styles.addBtn}
                onClick={(e) => handleAddToQueue(item, e)}
                aria-label={`Add ${item.name} to queue`}
              >
                <Plus size={18} />
              </button>
              {item.type !== 'track' && (
                <ChevronRight size={18} className={styles.chevron} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
