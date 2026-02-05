import { useLocation } from 'wouter';
import { List, Library, Search } from 'lucide-preact';

export function BottomNav() {
    const [location, setLocation] = useLocation();

    const navItems = [
        { path: '/', icon: List, label: 'Queue' },
        { path: '/library', icon: Library, label: 'Library' },
        { path: '/search', icon: Search, label: 'Search' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] bg-bg-secondary border-t border-border-primary flex justify-around items-center z-100 bottom-nav-after">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;

                return (
                    <button
                        key={item.path}
                        onClick={() => setLocation(item.path)}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-12 text-sm cursor-pointer bg-transparent border-none p-0 transition-colors duration-150 active:scale-95 ${isActive ? 'text-accent-primary' : 'text-fg-secondary'}`}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon className="w-6 h-6" />
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
