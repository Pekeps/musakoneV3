import type { ComponentChildren } from 'preact';
import { useStore } from '@nanostores/preact';
import { useLocation } from 'wouter';
import { connectionStatus } from '../stores/connection';
import { currentUser, setUser } from '../stores/auth';
import { logout } from '../services/auth';
import * as mopidy from '../services/mopidy';
import { BottomNav } from './BottomNav';
import { MiniPlayer } from './MiniPlayer';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ComponentChildren;
}

export function Layout({ children }: LayoutProps) {
  const status = useStore(connectionStatus);
  const user = useStore(currentUser);
  const [location, setLocation] = useLocation();

  const getStatusLabel = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    mopidy.disconnect();
    setLocation('/login');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>MusakoneV3</h1>
        <div className={styles.status}>
          <div className={`${styles.statusDot} ${styles[status]}`} />
          <span>{getStatusLabel()}</span>
          {user && (
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {children}
      </main>

      {location === '/' && <MiniPlayer />}
      <BottomNav />
    </div>
  );
}
