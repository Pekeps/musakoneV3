import * as mopidy from '../services/mopidy';

/**
 * Hook for managing queue operations (add to end, add next)
 * Shared logic used in Library and Search views
 */
export function useAddToQueue() {
    /**
     * Add track(s) to the end of the queue
     * @param uris - Single URI or array of URIs to add
     */
    const addToQueue = async (uris: string | string[]) => {
        try {
            const uriArray = Array.isArray(uris) ? uris : [uris];
            await mopidy.addToTracklist(uriArray);
        } catch (err) {
            console.error('Failed to add to queue:', err);
            throw err;
        }
    };

    /**
     * Add track(s) after the currently playing track
     * @param uris - Single URI or array of URIs to add
     */
    const addNext = async (uris: string | string[]) => {
        try {
            const queue = await mopidy.getTracklist();
            const currentTlid = await mopidy.getCurrentTlid();
            let insertPosition = 0;

            if (currentTlid) {
                const currentIndex = queue.findIndex((t) => t.tlid === currentTlid);
                if (currentIndex !== -1) {
                    insertPosition = currentIndex + 1;
                }
            }

            const uriArray = Array.isArray(uris) ? uris : [uris];
            await mopidy.addToTracklist(uriArray, insertPosition);
        } catch (err) {
            console.error('Failed to add next:', err);
            throw err;
        }
    };

    return {
        addToQueue,
        addNext,
    };
}
