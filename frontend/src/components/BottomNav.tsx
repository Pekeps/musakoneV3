import { Library, List, Search } from 'lucide-preact';
import { useLocation } from 'wouter';
import styles from './BottomNav.module.css';

export function BottomNav() {
    const [location, setLocation] = useLocation();

    const navItems = [
        { path: '/', icon: List, label: 'Queue' },
        { path: '/library', icon: Library, label: 'Library' },
        { path: '/search', icon: Search, label: 'Search' },
    ];

    return (
        <nav className={styles.bottomNav}>
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;

                return (
                    <button
                        key={item.path}
                        onClick={() => setLocation(item.path)}
                        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon />
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
