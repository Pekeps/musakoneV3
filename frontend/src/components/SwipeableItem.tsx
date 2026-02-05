import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';

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
            setAnimating('left');
            setTimeout(() => {
                onSwipeLeft();
                setTimeout(() => {
                    setSwipeX(0);
                    setAnimating(null);
                }, 150);
            }, 200);
        } else if (swipeX > threshold && onSwipeRight) {
            setAnimating('right');
            setTimeout(() => {
                onSwipeRight();
                setTimeout(() => {
                    setSwipeX(0);
                    setAnimating(null);
                }, 150);
            }, 200);
        } else {
            setSwipeX(0);
        }
    };

    const getSwipeIndicator = () => {
        if (animating === 'left') return 'swipe-left-active';
        if (animating === 'right') return 'swipe-right-active';
        if (swipeX < -threshold) return 'swipe-left-active';
        if (swipeX > threshold) return 'swipe-right-active';
        if (swipeX < -20) return 'swipe-left';
        if (swipeX > 20) return 'swipe-right';
        return '';
    };

    const getTransform = () => {
        if (animating === 'left') return 'translateX(-100%)';
        if (animating === 'right') return 'translateX(100%)';
        return `translateX(${swipeX}px)`;
    };

    return (
        <div className={`relative overflow-hidden w-full ${getSwipeIndicator()} ${wrapperClassName}`}>
            {onSwipeLeft && <div className="swipe-hint swipe-hint-left">{leftLabel}</div>}
            {onSwipeRight && <div className="swipe-hint swipe-hint-right">{rightLabel}</div>}
            <div
                className={`relative z-1 bg-bg-primary transition-transform duration-150 ${animating ? 'duration-200' : ''} ${className}`}
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
