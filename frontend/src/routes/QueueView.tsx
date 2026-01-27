import { useStore } from '@nanostores/preact';
import { GripVertical, Play, RefreshCw, Trash2 } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { TrackItem } from '../components/TrackItem';
import * as mopidy from '../services/mopidy';
import { currentTrack } from '../stores/player';
import { queue, scrollToCurrentTrack, setQueue } from '../stores/queue';
import styles from './QueueView.module.css';

export function QueueView() {
    const queueTracks = useStore(queue);
    const current = useStore(currentTrack);
    const scrollTrigger = useStore(scrollToCurrentTrack);
    const [loading, setLoading] = useState(false);
    const [currentTlid, setCurrentTlid] = useState<number | null>(null);
    const [selectedTlid, setSelectedTlid] = useState<number | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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
            console.error('Failed to load queue:', err);
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
                    console.error('Failed to get current tlid:', err);
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
                block: 'center',
            });
        }
    }, [scrollTrigger]);

    // Close overlay when clicking anywhere
    useEffect(() => {
        if (selectedTlid === null) return;

        const handleClickOutside = () => setSelectedTlid(null);
        // Delay adding listener to avoid catching the double-click that opened it
        const timeout = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [selectedTlid]);

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
            if (selectedTlid === tlid) setSelectedTlid(null);
        } catch (err) {
            console.error('Failed to remove track:', err);
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

    const handleDragStart = (e: DragEvent, index: number) => {
        setDraggedIndex(index);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());
        }
    };

    const handleDragOver = (e: DragEvent, index: number) => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (e: DragEvent) => {
        // Only clear dragOver if we're actually leaving the drop zone
        // (not just moving to a child element)
        const target = e.currentTarget as HTMLElement;
        const related = e.relatedTarget as Node | null;
        if (!related || !target.contains(related)) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = async (e: DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const fromIndex = draggedIndex;
        const toIndex = dropIndex;

        // Optimistic update: move track locally first
        const newQueue = [...queueTracks];
        const [movedTrack] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, movedTrack);
        setQueue(newQueue);

        // Clear drag state immediately for better UX
        setDraggedIndex(null);
        setDragOverIndex(null);

        try {
            // Mopidy API: when moving down, we need to adjust the target position
            // because we're removing from a lower index first
            const mopidyToPosition = fromIndex < toIndex ? toIndex - 1 : toIndex;
            await mopidy.moveTrack(fromIndex, fromIndex + 1, mopidyToPosition);
        } catch (err) {
            console.error('Failed to move track:', err);
            // Reload queue on error to sync with server state
            await loadQueue();
        }
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
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
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;
                    
                    const wrapperClasses = [
                        styles.trackWrapper,
                        isCurrentTrack && styles.current,
                        isDragging && styles.dragging,
                        isDragOver && styles.dragOver,
                    ].filter(Boolean).join(' ');

                    return (
                        <div
                            key={item.tlid}
                            ref={isCurrentTrack ? currentTrackRef : null}
                            className={wrapperClasses}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={(e) => handleDragLeave(e)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                        >
                            <TrackItem
                                track={item.track}
                                className={styles.track}
                                leftContent={
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
                                }
                                rightContent={
                                    <div className={styles.dragHandle}>
                                        <GripVertical size={20} />
                                    </div>
                                }
                                onDoubleClick={() => handleTrackDoubleClick(item.tlid)}
                            />
                            {isSelected && (
                                <div
                                    className={styles.overlay}
                                    onClick={(e) => e.stopPropagation()}
                                >
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
