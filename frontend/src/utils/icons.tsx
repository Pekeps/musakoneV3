import { Disc, Folder, Music, User } from 'lucide-preact';
import type { JSX } from 'preact';
import type { LibraryRef } from '../services/mopidy';

/**
 * Get the appropriate icon for a library item type
 *
 * @param type - The type of library reference (directory, artist, album, track, playlist)
 * @returns JSX element with the appropriate icon
 */
export function getLibraryIcon(type: LibraryRef['type']): JSX.Element {
    switch (type) {
        case 'directory':
            return <Folder size={20} />;
        case 'artist':
            return <User size={20} />;
        case 'album':
            return <Disc size={20} />;
        case 'track':
            return <Music size={20} />;
        case 'playlist':
            return <Folder size={20} />;
        default:
            return <Folder size={20} />;
    }
}
