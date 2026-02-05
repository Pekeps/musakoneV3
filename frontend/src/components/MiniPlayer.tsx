import { useStore } from '@nanostores/preact';
import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'wouter';
import * as mopidy from '../services/mopidy';
import {
    currentTrack,
    isPlaying,
    timePosition,
    updatePlaybackState,
    volume,
} from '../stores/player';
import { triggerScrollToCurrent } from '../stores/queue';
import { formatDuration } from '../utils/format';

/** How often to sync with backend to correct drift (in seconds) */
const BACKEND_SYNC_INTERVAL_SECONDS = 10;

/** Threshold in ms - if position is below this, previous goes to previous track */
const PREVIOUS_THRESHOLD_MS = 3000;

export function MiniPlayer() {
    const track = useStore(currentTrack);
    const playing = useStore(isPlaying);
    const position = useStore(timePosition);
    const currentVolume = useStore(volume);
    const [location, setLocation] = useLocation();
    const [volumeOpen, setVolumeOpen] = useState(false);
    const localUpdateInterval = useRef<number | null>(null);
    const lastSyncTime = useRef<number>(Date.now());
    const lastSyncPosition = useRef<number>(position);
    const volumePopupRef = useRef<HTMLDivElement>(null);

    // Update time position while playing - derive locally, sync periodically
    useEffect(() => {
        if (playing && track) {
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
                        const derivedPosition = lastSyncPosition.current + elapsed;
                        updatePlaybackState({ timePosition: derivedPosition });
                    }
                } else {
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

    // Close volume popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                volumeOpen &&
                volumePopupRef.current &&
                !volumePopupRef.current.contains(event.target as Node)
            ) {
                setVolumeOpen(false);
            }
        };

        if (volumeOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside as any);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside as any);
        };
    }, [volumeOpen]);

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
            if (position <= PREVIOUS_THRESHOLD_MS) {
                await mopidy.previous();
            } else {
                await mopidy.seek(0);
                updatePlaybackState({ timePosition: 0 });
                lastSyncTime.current = Date.now();
                lastSyncPosition.current = 0;
            }
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
            lastSyncTime.current = Date.now();
            lastSyncPosition.current = newPosition;
        } catch (err) {
            console.error('Failed to seek:', err);
        }
    };

    const handleVolumeChange = async (e: Event) => {
        const input = e.target as HTMLInputElement;
        const newVolume = parseInt(input.value, 10);
        try {
            await mopidy.setVolume(newVolume);
            updatePlaybackState({ volume: newVolume });
        } catch (err) {
            console.error('Failed to set volume:', err);
        }
    };

    const progress = track?.duration ? (position / track.duration) * 100 : 0;

    const handleTrackClick = () => {
        if (!track) return;
        setTimeout(() => {
            triggerScrollToCurrent();
        }, 100);
    };

    return (
        <div className="fixed bottom-[var(--bottom-nav-height)] left-0 right-0 bg-bg-tertiary border-t border-border-primary flex flex-col z-99">
            {/* Progress bar */}
            <div className="progress-bar" style={{ '--progress': `${progress}%` }}>
                {track && (
                    <input
                        type="range"
                        className="absolute -top-1.5 left-0 w-full h-4 m-0 opacity-0 cursor-pointer z-1"
                        min={0}
                        max={track.duration || 100}
                        value={position}
                        onChange={handleSeek}
                        aria-label="Seek"
                    />
                )}
            </div>

            <div className="flex items-center px-2 py-1 gap-1">
                <div
                    className={`flex-1 min-w-0 flex flex-col gap-0.5 ${track ? 'cursor-pointer select-none active:opacity-70' : ''}`}
                    onClick={handleTrackClick}
                >
                    {track ? (
                        <>
                            <div className="text-base text-fg-primary truncate">{track.name}</div>
                            <div className="text-sm text-fg-secondary truncate">
                                {track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
                            </div>
                        </>
                    ) : (
                        <div className="text-fg-tertiary italic">No track playing</div>
                    )}
                </div>

                {track && (
                    <div className="text-xs text-fg-tertiary whitespace-nowrap shrink-0">
                        {formatDuration(position)} / {formatDuration(track.duration)}
                    </div>
                )}

                <div className="flex gap-1 shrink-0">
                    <button
                        className="btn-control"
                        onClick={handlePrevious}
                        disabled={!track}
                        aria-label="Previous track"
                    >
                        <SkipBack size={20} />
                    </button>

                    <button
                        className={`btn-control ${playing ? '' : ''} bg-accent-primary text-bg-primary border-accent-primary hover:brightness-110 active:brightness-90`}
                        onClick={handlePlayPause}
                        disabled={!track}
                        aria-label={playing ? 'Pause' : 'Play'}
                    >
                        {playing ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    <button
                        className="btn-control"
                        onClick={handleNext}
                        disabled={!track}
                        aria-label="Next track"
                    >
                        <SkipForward size={20} />
                    </button>
                </div>

                <div className="relative flex items-center shrink-0" ref={volumePopupRef}>
                    <button
                        className={`btn-control ${volumeOpen ? 'border-accent-primary' : ''}`}
                        onClick={() => setVolumeOpen(!volumeOpen)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && volumeOpen) {
                                setVolumeOpen(false);
                            }
                        }}
                        aria-label="Volume control"
                        aria-expanded={volumeOpen}
                    >
                        <Volume2 size={20} />
                    </button>

                    {volumeOpen && (
                        <div className="absolute bottom-[calc(100%+0.5rem)] right-0 bg-bg-tertiary border border-border-primary rounded-lg px-2 py-3 flex flex-col items-center gap-2 z-100 shadow-lg">
                            <input
                                type="range"
                                className="volume-slider"
                                min={0}
                                max={100}
                                value={currentVolume}
                                onChange={handleVolumeChange}
                                aria-label="Volume"
                            />
                            <div className="text-xs text-fg-secondary min-w-10 text-center">{currentVolume}%</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
