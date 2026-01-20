import { useStore } from '@nanostores/preact';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-preact';
import { currentTrack, isPlaying } from '../stores/player';
import { backendWS } from '../services/websocket';
import styles from './MiniPlayer.module.css';

export function MiniPlayer() {
  const track = useStore(currentTrack);
  const playing = useStore(isPlaying);

  const handlePlayPause = () => {
    if (playing) {
      backendWS.pause();
    } else {
      backendWS.play();
    }
  };

  const handleNext = () => {
    backendWS.next();
  };

  const handlePrevious = () => {
    backendWS.previous();
  };

  return (
    <div className={styles.miniPlayer}>
      <div className={styles.trackInfo}>
        {track ? (
          <>
            <div className={styles.trackName}>{track.name}</div>
            <div className={styles.trackArtist}>
              {track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
            </div>
          </>
        ) : (
          <div className={styles.noTrack}>No track playing</div>
        )}
      </div>
      
      <div className={styles.controls}>
        <button
          className={styles.controlButton}
          onClick={handlePrevious}
          disabled={!track}
          aria-label="Previous track"
        >
          <SkipBack />
        </button>
        
        <button
          className={`${styles.controlButton} ${styles.playButton}`}
          onClick={handlePlayPause}
          disabled={!track}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        
        <button
          className={styles.controlButton}
          onClick={handleNext}
          disabled={!track}
          aria-label="Next track"
        >
          <SkipForward />
        </button>
      </div>
    </div>
  );
}
