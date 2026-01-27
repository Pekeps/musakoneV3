import type { JSX } from 'preact';
import { Music } from 'lucide-preact';
import { formatDuration } from '../utils/format';
import styles from './TrackItem.module.css';

export interface TrackItemData {
    name: string;
    duration?: number;
    artists?: Array<{ name: string }>;
    album?: { name: string } | null;
}

interface TrackItemProps {
    /** Track data to display */
    track: TrackItemData;
    /** Optional icon to display (defaults to Music icon) */
    icon?: JSX.Element;
    /** Optional left content (e.g., index or playing indicator) */
    leftContent?: JSX.Element;
    /** Optional right content (e.g., buttons or status) */
    rightContent?: JSX.Element;
    /** Additional CSS classes */
    className?: string;
    /** Show album name in metadata */
    showAlbum?: boolean;
    /** Show duration */
    showDuration?: boolean;
    /** Custom metadata display */
    customMeta?: string;
    /** Click handler */
    onClick?: () => void;
    /** Double click handler */
    onDoubleClick?: () => void;
}

/**
 * Reusable track item component for displaying track information
 * Used across Queue, Library, and Search views with different configurations
 */
export function TrackItem({
    track,
    icon,
    leftContent,
    rightContent,
    className = '',
    showAlbum = false,
    showDuration = true,
    customMeta,
    onClick,
    onDoubleClick,
}: TrackItemProps) {
    const artistNames = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
    const metadata = customMeta || (showAlbum && track.album ? `${artistNames} • ${track.album.name}` : artistNames);

    return (
        <div
            className={`${styles.track} ${className}`}
            onClick={onClick}
            onDblClick={onDoubleClick}
        >
            {leftContent && <div className={styles.leftContent}>{leftContent}</div>}
            
            {icon && <div className={styles.icon}>{icon}</div>}
            
            <div className={styles.info}>
                <div className={styles.name}>{track.name}</div>
                <div className={styles.meta}>{metadata}</div>
            </div>
            
            {showDuration && track.duration !== undefined && (
                <div className={styles.duration}>{formatDuration(track.duration)}</div>
            )}
            
            {rightContent && <div className={styles.rightContent}>{rightContent}</div>}
        </div>
    );
}

/**
 * Default icon for track items
 */
export const DefaultTrackIcon = <Music size={20} />;
