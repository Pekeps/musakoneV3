import { useStore } from '@nanostores/preact';
import { queue } from '../stores/queue';
import styles from './QueueView.module.css';

export function QueueView() {
  const queueTracks = useStore(queue);

  if (queueTracks.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Queue is empty</p>
        <p className={styles.hint}>Add tracks from Library or Search</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Queue ({queueTracks.length})</h2>
      <div className={styles.list}>
        {queueTracks.map((item, index) => (
          <div key={item.tlid} className={styles.track}>
            <div className={styles.index}>{index + 1}</div>
            <div className={styles.info}>
              <div className={styles.name}>{item.track.name}</div>
              <div className={styles.artist}>
                {item.track.artists?.map((a) => a.name).join(', ') || 'Unknown'}
              </div>
            </div>
            <div className={styles.duration}>
              {formatDuration(item.track.duration)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
