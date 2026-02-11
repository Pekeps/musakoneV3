import { useStore } from '@nanostores/preact';
import { GripVertical, MoreVertical, Play, RefreshCw, Shuffle, Trash2 } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { confirm } from '../components/ConfirmModal';
import { TrackItem } from '../components/TrackItem';
import * as mopidy from '../services/mopidy';
import { currentTrack } from '../stores/player';
import { queue, scrollToCurrentTrack, setQueue } from '../stores/queue';

export function QueueView() {
    const queueTracks = useStore(queue);
    const current = useStore(currentTrack);
    const scrollTrigger = useStore(scrollToCurrentTrack);
    const [loading, setLoading] = useState(false);
    const [currentTlid, setCurrentTlid] = useState<number | null>(null);
    const [selectedTlid, setSelectedTlid] = useState<number | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const currentTrackRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (scrollTrigger > 0 && currentTrackRef.current) {
            currentTrackRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [scrollTrigger]);

    useEffect(() => {
        if (selectedTlid === null) return;

        const handleClickOutside = () => setSelectedTlid(null);
        const timeout = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [selectedTlid]);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!menuOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [menuOpen]);

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

    const handleClearQueue = () => {
        setMenuOpen(false);
        confirm({
            title: 'Clear Queue',
            message: `Remove all ${queueTracks.length} tracks from the queue?`,
            confirmLabel: 'Clear',
            destructive: true,
            onConfirm: async () => {
                try {
                    await mopidy.clearTracklist();
                    await loadQueue();
                } catch (err) {
                    console.error('Failed to clear queue:', err);
                }
            },
        });
    };

    const handleShuffle = () => {
        setMenuOpen(false);
        confirm({
            title: 'Shuffle Queue',
            message: 'Randomize the order of all tracks in the queue?',
            confirmLabel: 'Shuffle',
            onConfirm: async () => {
                try {
                    await mopidy.shuffleTracklist();
                    await loadQueue();
                } catch (err) {
                    console.error('Failed to shuffle queue:', err);
                }
            },
        });
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

        const newQueue = [...queueTracks];
        const [movedTrack] = newQueue.splice(fromIndex, 1);
        if (!movedTrack) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }
        newQueue.splice(toIndex, 0, movedTrack);
        setQueue(newQueue);

        setDraggedIndex(null);
        setDragOverIndex(null);

        try {
            const mopidyToPosition = fromIndex < toIndex ? toIndex - 1 : toIndex;
            await mopidy.moveTrack(fromIndex, fromIndex + 1, mopidyToPosition);
        } catch (err) {
            console.error('Failed to move track:', err);
            await loadQueue();
        }
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    if (loading && queueTracks.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-center min-h-[50vh] text-fg-secondary">
                    Loading queue...
                </div>
            </div>
        );
    }

    if (queueTracks.length === 0) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-fg-secondary text-center px-8">
                    <p>Queue is empty</p>
                    <p className="text-sm text-fg-tertiary">Add tracks from Library or Search</p>
                    <button
                        className="flex items-center gap-2 mt-4 px-4 py-2 bg-bg-secondary border border-border-primary text-fg-secondary font-mono text-sm cursor-pointer transition-all duration-150 hover:text-accent-primary hover:border-accent-primary"
                        onClick={loadQueue}
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Queue header with actions menu */}
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-border-primary shrink-0 bg-bg-secondary">
                <span className="text-fg-secondary text-sm">{queueTracks.length} tracks</span>
                <div className="relative" ref={menuRef}>
                    <button
                        className="flex items-center justify-center w-8 h-8 bg-transparent border-none text-fg-secondary cursor-pointer transition-colors duration-150 hover:text-fg-primary"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Queue actions"
                    >
                        <MoreVertical size={18} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-1 min-w-40 bg-bg-secondary border border-border-primary z-50 shadow-lg">
                            <button
                                className="flex items-center gap-2 w-full px-3 py-2.5 bg-transparent border-none text-fg-primary text-sm font-mono text-left cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary"
                                onClick={handleShuffle}
                            >
                                <Shuffle size={15} />
                                Shuffle
                            </button>
                            <button
                                className="flex items-center gap-2 w-full px-3 py-2.5 bg-transparent border-none text-error text-sm font-mono text-left cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary"
                                onClick={handleClearQueue}
                            >
                                <Trash2 size={15} />
                                Clear Queue
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-[var(--mini-player-height)]">
                {queueTracks.map((item, index) => {
                    const isCurrentTrack = item.tlid === currentTlid || item.track.uri === current?.uri;
                    const isSelected = selectedTlid === item.tlid;
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;

                    return (
                        <div
                            key={item.tlid}
                            ref={isCurrentTrack ? currentTrackRef : null}
                            className={`relative ${isCurrentTrack ? 'bg-bg-secondary border-l-3 border-l-accent-primary' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-3 border-t-accent-primary' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={(e) => handleDragLeave(e)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                        >
                            <TrackItem
                                track={item.track}
                                className={`cursor-pointer ${isCurrentTrack ? 'bg-bg-secondary' : ''}`}
                                leftContent={
                                    <div className="flex items-center justify-center w-10 h-10 text-fg-tertiary shrink-0">
                                        {isCurrentTrack ? (
                                            <span className="playing-indicator flex items-end justify-center gap-0.5 h-4">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </span>
                                        ) : (
                                            <span className="text-sm font-mono">{index + 1}</span>
                                        )}
                                    </div>
                                }
                                rightContent={
                                    <div className="flex items-center justify-center w-10 h-10 text-fg-tertiary shrink-0 cursor-grab hover:text-fg-secondary active:cursor-grabbing">
                                        <GripVertical size={20} />
                                    </div>
                                }
                                onDoubleClick={() => handleTrackDoubleClick(item.tlid)}
                            />
                            {isSelected && (
                                <div
                                    className="absolute inset-0 flex gap-px bg-border-primary"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        className="flex-1 flex items-center justify-center gap-1 bg-bg-secondary border-none text-fg-primary font-mono text-sm cursor-pointer transition-all duration-150 hover:bg-bg-tertiary hover:text-accent-primary"
                                        onClick={() => {
                                            handlePlayTrack(item.tlid);
                                            setSelectedTlid(null);
                                        }}
                                    >
                                        <Play size={18} />
                                        Play
                                    </button>
                                    <button
                                        className="flex-1 flex items-center justify-center gap-1 bg-bg-secondary border-none text-fg-primary font-mono text-sm cursor-pointer transition-all duration-150 hover:bg-bg-tertiary hover:text-error"
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
