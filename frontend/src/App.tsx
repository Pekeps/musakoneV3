import { useEffect } from 'preact/hooks';
import { Route, Switch, useLocation } from 'wouter';
import { useStore } from '@nanostores/preact';
import { connectionStatus } from './stores/connection';
import { currentUser } from './stores/auth';
import { setUser, setAuthLoading } from './stores/auth';
import { getCurrentUser, isAuthenticated, logout } from './services/auth';
import { backendWS } from './services/websocket';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { QueueView } from './routes/QueueView';
import { LibraryView } from './routes/LibraryView';
import { SearchView } from './routes/SearchView';
import { Login } from './routes/Login';
import { Register } from './routes/Register';
import styles from './App.module.css';

export const App = () => {
  const status = useStore(connectionStatus);
  const user = useStore(currentUser);
  const [, setLocation] = useLocation();

  // Load user on app startup if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (isAuthenticated()) {
        setAuthLoading(true);
        try {
          const userData = await getCurrentUser();
          if (userData.authenticated) {
            setUser({
              id: userData.id,
              username: 'user',
              created_at: Date.now() / 1000
            });
          }
        } catch (err) {
          console.error('Failed to load user:', err);
          logout();
        } finally {
          setAuthLoading(false);
        }
      }
    };
    
    loadUser();
  }, []);

  useEffect(() => {
    // Connect to backend WebSocket on mount (only if authenticated)
    if (user) {
      backendWS.connect();
    }

    return () => {
      backendWS.disconnect();
    };
  }, [user]);

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
    backendWS.disconnect();
    setLocation('/login');
  };

  return (
    <div className={styles.app}>
      <Switch>
        {/* Public routes */}
        <Route path="/login">
          <Login />
        </Route>
        
        <Route path="/register">
          <Register />
        </Route>
        
        {/* Protected home route */}
        <Route path="/">
          <ProtectedRoute>
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
              <QueueView />
            </main>

            <MiniPlayer />
            <BottomNav />
          </ProtectedRoute>
        </Route>
        
        {/* Protected library route */}
        <Route path="/library">
          <ProtectedRoute>
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
              <LibraryView />
            </main>

            <MiniPlayer />
            <BottomNav />
          </ProtectedRoute>
        </Route>
        
        {/* Protected search route */}
        <Route path="/search">
          <ProtectedRoute>
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
              <SearchView />
            </main>

            <MiniPlayer />
            <BottomNav />
          </ProtectedRoute>
        </Route>
      </Switch>
    </div>
  );
};

