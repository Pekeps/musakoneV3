import { useEffect, useState } from 'preact/hooks';
import type { PlaybackOptions } from '../services/mopidy';
import * as mopidy from '../services/mopidy';

/**
 * ncmpcpp-style playback flags display
 * Shows [rzscp] where each letter is active/inactive
 * r = repeat, z = random, s = single, c = consume
 */
export function PlaybackFlags() {
    const [options, setOptions] = useState<PlaybackOptions>({
        repeat: false,
        random: false,
        single: false,
        consume: false,
    });
    const [loading, setLoading] = useState(true);

    const loadOptions = async () => {
        try {
            const opts = await mopidy.getPlaybackOptions();
            setOptions(opts);
        } catch (err) {
            console.error('Failed to load playback options:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOptions();
    }, []);

    const toggleOption = async (key: keyof PlaybackOptions) => {
        const newValue = !options[key];
        const prevOptions = { ...options };

        // Optimistic update
        setOptions({ ...options, [key]: newValue });

        try {
            switch (key) {
                case 'repeat':
                    await mopidy.setRepeat(newValue);
                    break;
                case 'random':
                    await mopidy.setRandom(newValue);
                    break;
                case 'single':
                    await mopidy.setSingle(newValue);
                    break;
                case 'consume':
                    await mopidy.setConsume(newValue);
                    break;
            }
        } catch (err) {
            console.error(`Failed to toggle ${key}:`, err);
            // Revert on error
            setOptions(prevOptions);
        }
    };

    if (loading) {
        return <div className="font-mono text-xs text-fg-secondary inline-flex items-center select-none">[____]</div>;
    }

    return (
        <div className="font-mono text-xs text-fg-secondary inline-flex items-center select-none">
            [
            <button
                className={`playback-flag ${options.repeat ? 'playback-flag-active' : ''}`}
                onClick={() => toggleOption('repeat')}
                title="Repeat"
            >
                {options.repeat ? 'r' : '_'}
            </button>
            <button
                className={`playback-flag ${options.random ? 'playback-flag-active' : ''}`}
                onClick={() => toggleOption('random')}
                title="Random/Shuffle"
            >
                {options.random ? 'z' : '_'}
            </button>
            <button
                className={`playback-flag ${options.single ? 'playback-flag-active' : ''}`}
                onClick={() => toggleOption('single')}
                title="Single"
            >
                {options.single ? 's' : '_'}
            </button>
            <button
                className={`playback-flag ${options.consume ? 'playback-flag-active' : ''}`}
                onClick={() => toggleOption('consume')}
                title="Consume"
            >
                {options.consume ? 'c' : '_'}
            </button>
            ]
        </div>
    );
}
