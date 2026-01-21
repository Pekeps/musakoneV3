import { useEffect, useRef } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-preact';
import {
  currentTrack,
  isPlaying,
  timePosition,
  updatePlaybackState,
} from '../stores/player';
import * as mopidy from '../services/mopidy';
import styles from './MiniPlayer.module.css';

export function MiniPlayer() {
  const track = useStore(currentTrack);
  const playing = useStore(isPlaying);
  const position = useStore(timePosition);
  const positionInterval = useRef<number | null>(null);


  // Update time position while playing
  useEffect(() => {
    if (playing && track) {
      positionInterval.current = window.setInterval(async () => {
        try {
          const pos = await mopidy.getTimePosition();
          updatePlaybackState({ timePosition: pos });
        } catch {
          // Ignore position fetch errors
        }
      }, 1000);
    }

    return () => {
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
    };
  }, [playing, track]);

  const handlePlayPause = async () => {
    try {
      if (playing) {
        await mopidy.pause();
      } else {
        await mopidy.resume();
      }
    } catch (err) {
      console.error('Failed to toggle playback:', err);
    }
  };

  const handleNext = async () => {
    try {
      await mopidy.next();
    } catch (err) {
      console.error('Failed to skip to next:', err);
    }
  };

  const handlePrevious = async () => {
    try {
      await mopidy.previous();
    } catch (err) {
      console.error('Failed to skip to previous:', err);
    }
  };

  const handleSeek = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const newPosition = parseInt(input.value, 10);
    try {
      await mopidy.seek(newPosition);
      updatePlaybackState({ timePosition: newPosition });
    } catch (err) {
      console.error('Failed to seek:', err);
    }
  };

  const progress = track?.duration ? (position / track.duration) * 100 : 0;

  return (
    <div className={styles.miniPlayer}>
      {/* Progress bar */}
      <div
        className={styles.progressBar}
        style={{ '--progress': `${progress}%` } as React.CSSProperties}
      >
        {track && (
          <input
            type="range"
            className={styles.progressInput}
            min={0}
            max={track.duration || 100}
            value={position}
            onChange={handleSeek}
            aria-label="Seek"
          />
        )}
      </div>

      <div className={styles.content}>
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

        {track && (
          <div className={styles.time}>
            {formatDuration(position)} / {formatDuration(track.duration)}
          </div>
        )}

        <div className={styles.controls}>
          <button
            className={styles.controlButton}
            onClick={handlePrevious}
            disabled={!track}
            aria-label="Previous track"
          >
            <SkipBack size={20} />
          </button>

          <button
            className={`${styles.controlButton} ${styles.playButton}`}
            onClick={handlePlayPause}
            disabled={!track}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <button
            className={styles.controlButton}
            onClick={handleNext}
            disabled={!track}
            aria-label="Next track"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms) return '0:00';
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
