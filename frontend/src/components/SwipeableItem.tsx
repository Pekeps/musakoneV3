import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import styles from './SwipeableItem.module.css';

interface SwipeableItemProps {
    children: JSX.Element;
    isDisabled?: boolean;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    leftLabel?: string;
    rightLabel?: string;
    threshold?: number;
    className?: string;
    wrapperClassName?: string;
}

/**
 * A swipeable item component that triggers actions on left/right swipe
 * Used for track items in Library and Search views
 *
 * @param children - The content to display
 * @param isDisabled - Whether swiping is disabled
 * @param onSwipeLeft - Callback when swiped left past threshold
 * @param onSwipeRight - Callback when swiped right past threshold
 * @param leftLabel - Label to show when swiping left
 * @param rightLabel - Label to show when swiping right
 * @param threshold - Swipe distance threshold in pixels (default: 80)
 * @param className - Additional CSS class for the item
 * @param wrapperClassName - Additional CSS class for the wrapper
 */
export function SwipeableItem({
    children,
    isDisabled = false,
    onSwipeLeft,
    onSwipeRight,
    leftLabel = '+ Add Next',
    rightLabel = '+ Add to End',
    threshold = 80,
    className = '',
    wrapperClassName = '',
}: SwipeableItemProps) {
    const [swipeX, setSwipeX] = useState(0);
    const [swiping, setSwiping] = useState(false);
    const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
    const startX = useRef(0);

    const handleTouchStart = (e: TouchEvent) => {
        if (isDisabled || animating) return;
        startX.current = e.touches[0]?.clientX || 0;
        setSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!swiping || isDisabled || animating) return;
        const diff = (e.touches[0]?.clientX || 0) - startX.current;
        setSwipeX(Math.max(-150, Math.min(150, diff)));
    };

    const handleTouchEnd = () => {
        if (!swiping || isDisabled || animating) return;
        setSwiping(false);

        if (swipeX < -threshold && onSwipeLeft) {
            // Swipe left - animate and trigger callback
            setAnimating('left');
            setTimeout(() => {
                onSwipeLeft();
                setTimeout(() => {
                    setSwipeX(0);
                    setAnimating(null);
                }, 150);
            }, 200);
        } else if (swipeX > threshold && onSwipeRight) {
            // Swipe right - animate and trigger callback
            setAnimating('right');
            setTimeout(() => {
                onSwipeRight();
                setTimeout(() => {
                    setSwipeX(0);
                    setAnimating(null);
                }, 150);
            }, 200);
        } else {
            // Reset if threshold not met
            setSwipeX(0);
        }
    };

    const getSwipeIndicator = () => {
        if (animating === 'left') return styles.swipeLeftActive;
        if (animating === 'right') return styles.swipeRightActive;
        if (swipeX < -threshold) return styles.swipeLeftActive;
        if (swipeX > threshold) return styles.swipeRightActive;
        if (swipeX < -20) return styles.swipeLeft;
        if (swipeX > 20) return styles.swipeRight;
        return '';
    };

    const getTransform = () => {
        if (animating === 'left') return 'translateX(-100%)';
        if (animating === 'right') return 'translateX(100%)';
        return `translateX(${swipeX}px)`;
    };

    return (
        <div className={`${styles.wrapper} ${getSwipeIndicator()} ${wrapperClassName}`}>
            {onSwipeLeft && <div className={`${styles.hint} ${styles.hintLeft}`}>{leftLabel}</div>}
            {onSwipeRight && (
                <div className={`${styles.hint} ${styles.hintRight}`}>{rightLabel}</div>
            )}
            <div
                className={`${styles.item} ${animating ? styles.itemAnimating : ''} ${className}`}
                style={{ transform: getTransform() }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}
