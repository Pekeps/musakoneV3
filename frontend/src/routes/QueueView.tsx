import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { Trash2, X, Play, RefreshCw } from 'lucide-preact';
import { queue, setQueue } from '../stores/queue';
import { currentTrack } from '../stores/player';
import * as mopidy from '../services/mopidy';
import styles from './QueueView.module.css';

export function QueueView() {
  const queueTracks = useStore(queue);
  const current = useStore(currentTrack);
  const [loading, setLoading] = useState(false);
  const [currentTlid, setCurrentTlid] = useState<number | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [tracks, tlid] = await Promise.all([
        mopidy.getTracklist(),
        mopidy.getCurrentTlid(),
      ]);
      setQueue(tracks);
      setCurrentTlid(tlid);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handlePlayTrack = async (tlid: number) => {
    try {
      await mopidy.play(tlid);
      setCurrentTlid(tlid);
    } catch (err) {
      console.error('Failed to play track:', err);
    }
  };

  const handleRemoveTrack = async (tlid: number) => {
    try {
      await mopidy.removeFromTracklist([tlid]);
      setQueue(queueTracks.filter((t) => t.tlid !== tlid));
    } catch (err) {
      console.error('Failed to remove track:', err);
    }
  };

  const handleClearQueue = async () => {
    try {
      await mopidy.clearTracklist();
      setQueue([]);
      setCurrentTlid(null);
    } catch (err) {
      console.error('Failed to clear queue:', err);
    }
  };

  const handleShuffle = async () => {
    try {
      await mopidy.shuffleTracklist();
      await loadQueue();
    } catch (err) {
      console.error('Failed to shuffle queue:', err);
    }
  };

  if (loading && queueTracks.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading queue...</div>
      </div>
    );
  }

  if (queueTracks.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>Queue is empty</p>
          <p className={styles.hint}>Add tracks from Library or Search</p>
          <button className={styles.refreshBtn} onClick={loadQueue}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Queue ({queueTracks.length})</h2>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={loadQueue}
            disabled={loading}
            aria-label="Refresh queue"
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          </button>
          <button
            className={styles.actionBtn}
            onClick={handleShuffle}
            aria-label="Shuffle queue"
          >
            Shuffle
          </button>
          <button
            className={`${styles.actionBtn} ${styles.clearBtn}`}
            onClick={handleClearQueue}
            aria-label="Clear queue"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {queueTracks.map((item, index) => {
          const isCurrentTrack = item.tlid === currentTlid || item.track.uri === current?.uri;
          return (
            <div
              key={item.tlid}
              className={`${styles.track} ${isCurrentTrack ? styles.current : ''}`}
            >
              <button
                className={styles.playBtn}
                onClick={() => handlePlayTrack(item.tlid)}
                aria-label={`Play ${item.track.name}`}
              >
                {isCurrentTrack ? (
                  <span className={styles.playingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                ) : (
                  <span className={styles.index}>{index + 1}</span>
                )}
              </button>
              <div className={styles.info}>
                <div className={styles.name}>{item.track.name}</div>
                <div className={styles.artist}>
                  {item.track.artists?.map((a) => a.name).join(', ') || 'Unknown'}
                </div>
              </div>
              <div className={styles.duration}>
                {formatDuration(item.track.duration)}
              </div>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemoveTrack(item.tlid)}
                aria-label={`Remove ${item.track.name}`}
              >
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>
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
