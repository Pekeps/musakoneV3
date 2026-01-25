import { useEffect, useRef } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import { useLocation } from "wouter";
import { Play, Pause, SkipForward, SkipBack } from "lucide-preact";
import {
  currentTrack,
  isPlaying,
  timePosition,
  updatePlaybackState,
} from "../stores/player";
import { triggerScrollToCurrent } from "../stores/queue";
import * as mopidy from "../services/mopidy";
import styles from "./MiniPlayer.module.css";

/** How often to sync with backend to correct drift (in seconds) */
const BACKEND_SYNC_INTERVAL_SECONDS = 10;

/** Threshold in ms - if position is below this, previous goes to previous track */
const PREVIOUS_THRESHOLD_MS = 3000;

export function MiniPlayer() {
  const track = useStore(currentTrack);
  const playing = useStore(isPlaying);
  const position = useStore(timePosition);
  const [location, setLocation] = useLocation();
  const localUpdateInterval = useRef<number | null>(null);
  const lastSyncTime = useRef<number>(Date.now());
  const lastSyncPosition = useRef<number>(position);

  // Update time position while playing - derive locally, sync periodically
  useEffect(() => {
    if (playing && track) {
      // Reset sync reference when playback starts
      lastSyncTime.current = Date.now();
      lastSyncPosition.current = position;

      localUpdateInterval.current = window.setInterval(async () => {
        const now = Date.now();
        const elapsed = now - lastSyncTime.current;
        const secondsSinceSync = elapsed / 1000;

        if (secondsSinceSync >= BACKEND_SYNC_INTERVAL_SECONDS) {
          try {
            const pos = await mopidy.getTimePosition();
            updatePlaybackState({ timePosition: pos });
            lastSyncTime.current = now;
            lastSyncPosition.current = pos;
          } catch {
            // On error, continue with local derivation
            const derivedPosition = lastSyncPosition.current + elapsed;
            updatePlaybackState({ timePosition: derivedPosition });
          }
        } else {
          // Derive position locally based on elapsed time
          const derivedPosition = lastSyncPosition.current + elapsed;
          updatePlaybackState({ timePosition: derivedPosition });
        }
      }, 100);
    }

    return () => {
      if (localUpdateInterval.current) {
        clearInterval(localUpdateInterval.current);
        localUpdateInterval.current = null;
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
      console.error("Failed to toggle playback:", err);
    }
  };

  const handleNext = async () => {
    try {
      await mopidy.next();
    } catch (err) {
      console.error("Failed to skip to next:", err);
    }
  };

  const handlePrevious = async () => {
    try {
      if (position <= PREVIOUS_THRESHOLD_MS) {
        await mopidy.previous();
      } else {
        await mopidy.seek(0);
        updatePlaybackState({ timePosition: 0 });
        lastSyncTime.current = Date.now();
        lastSyncPosition.current = 0;
      }
    } catch (err) {
      console.error("Failed to skip to previous:", err);
    }
  };

  const handleSeek = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const newPosition = parseInt(input.value, 10);
    try {
      await mopidy.seek(newPosition);
      updatePlaybackState({ timePosition: newPosition });
      // Reset sync reference after seek
      lastSyncTime.current = Date.now();
      lastSyncPosition.current = newPosition;
    } catch (err) {
      console.error("Failed to seek:", err);
    }
  };

  const progress = track?.duration ? (position / track.duration) * 100 : 0;

  const handleTrackClick = () => {
    if (!track) return;
    // Wait a bit for navigation and render, then scroll
    setTimeout(() => {
      triggerScrollToCurrent();
    }, 100);
  };

  return (
    <div className={styles.miniPlayer}>
      {/* Progress bar */}
      <div
        className={styles.progressBar}
        style={{ "--progress": `${progress}%` }}
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
        <div 
          className={`${styles.trackInfo} ${track ? styles.clickable : ''}`}
          onClick={handleTrackClick}
        >
          {track ? (
            <>
              <div className={styles.trackName}>{track.name}</div>
              <div className={styles.trackArtist}>
                {track.artists?.map((a) => a.name).join(", ") ||
                  "Unknown Artist"}
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
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
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
  if (!ms) return "0:00";
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
