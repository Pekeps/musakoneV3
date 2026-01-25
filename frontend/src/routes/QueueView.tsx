import { useEffect, useState, useRef } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import { Trash2, Play, RefreshCw } from "lucide-preact";
import { queue, setQueue, scrollToCurrentTrack } from "../stores/queue";
import { currentTrack } from "../stores/player";
import * as mopidy from "../services/mopidy";
import styles from "./QueueView.module.css";

export function QueueView() {
  const queueTracks = useStore(queue);
  const current = useStore(currentTrack);
  const scrollTrigger = useStore(scrollToCurrentTrack);
  const [loading, setLoading] = useState(false);
  const [currentTlid, setCurrentTlid] = useState<number | null>(null);
  const [selectedTlid, setSelectedTlid] = useState<number | null>(null);
  const currentTrackRef = useRef<HTMLDivElement>(null);

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
      console.error("Failed to load queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  // Update currentTlid when track changes
  useEffect(() => {
    const updateCurrentTlid = async () => {
      if (current) {
        try {
          const tlid = await mopidy.getCurrentTlid();
          setCurrentTlid(tlid);
        } catch (err) {
          console.error("Failed to get current tlid:", err);
        }
      }
    };
    updateCurrentTlid();
  }, [current]);

  // Scroll to current track when triggered
  useEffect(() => {
    if (scrollTrigger > 0 && currentTrackRef.current) {
      currentTrackRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [scrollTrigger]);

  // Close overlay when clicking anywhere
  useEffect(() => {
    if (selectedTlid === null) return;

    const handleClickOutside = () => setSelectedTlid(null);
    // Delay adding listener to avoid catching the double-click that opened it
    const timeout = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [selectedTlid]);

  const handlePlayTrack = async (tlid: number) => {
    try {
      await mopidy.play(tlid);
      setCurrentTlid(tlid);
    } catch (err) {
      console.error("Failed to play track:", err);
    }
  };

  const handleRemoveTrack = async (tlid: number) => {
    try {
      await mopidy.removeFromTracklist([tlid]);
      setQueue(queueTracks.filter((t) => t.tlid !== tlid));
      if (selectedTlid === tlid) setSelectedTlid(null);
    } catch (err) {
      console.error("Failed to remove track:", err);
    }
  };

  const handleTrackDoubleClick = (tlid: number) => {
    setSelectedTlid(selectedTlid === tlid ? null : tlid);
  };

  const handleClearQueue = async () => {
    try {
      await mopidy.clearTracklist();
      await loadQueue();
    } catch (err) {
      console.error("Failed to clear queue:", err);
    }
  };

  const handleShuffle = async () => {
    try {
      await mopidy.shuffleTracklist();
      await loadQueue();
    } catch (err) {
      console.error("Failed to shuffle queue:", err);
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
      <div className={styles.list}>
        {queueTracks.map((item, index) => {
          const isCurrentTrack =
            item.tlid === currentTlid || item.track.uri === current?.uri;
          const isSelected = selectedTlid === item.tlid;
          return (
            <div
              key={item.tlid}
              ref={isCurrentTrack ? currentTrackRef : null}
              className={`${styles.track} ${isCurrentTrack ? styles.current : ""}`}
              onDblClick={() => handleTrackDoubleClick(item.tlid)}
            >
              <div className={styles.indexCell}>
                {isCurrentTrack ? (
                  <span className={styles.playingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                ) : (
                  <span className={styles.index}>{index + 1}</span>
                )}
              </div>
              <div className={styles.info}>
                <div className={styles.name}>{item.track.name}</div>
                <div className={styles.artist}>
                  {item.track.artists?.map((a) => a.name).join(", ") ||
                    "Unknown"}
                </div>
              </div>
              <div className={styles.duration}>
                {formatDuration(item.track.duration)}
              </div>
              {isSelected && (
                <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
                  <button
                    className={styles.overlayBtn}
                    onClick={() => {
                      handlePlayTrack(item.tlid);
                      setSelectedTlid(null);
                    }}
                  >
                    <Play size={18} />
                    Play
                  </button>
                  <button
                    className={`${styles.overlayBtn} ${styles.overlayBtnDanger}`}
                    onClick={() => handleRemoveTrack(item.tlid)}
                  >
                    <Trash2 size={18} />
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms) return "--:--";
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
