import { useEffect } from 'preact/hooks';
import { Route, Switch } from 'wouter';
import { useStore } from '@nanostores/preact';
import { currentUser, setUser, setAuthLoading } from './stores/auth';
import { getCurrentUser, isAuthenticated, logout } from './services/auth';
import * as mopidy from './services/mopidy';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { QueueView } from './routes/QueueView';
import { LibraryView } from './routes/LibraryView';
import { SearchView } from './routes/SearchView';
import { Login } from './routes/Login';
import { Register } from './routes/Register';
import styles from './App.module.css';

export const App = () => {
  const user = useStore(currentUser);

  // Load user on app startup if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (isAuthenticated()) {
        setAuthLoading(true);
        try {
          const userData = await getCurrentUser();
          setUser(userData);
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
      mopidy.connect().catch(console.error);
    }

    return () => {
      mopidy.disconnect();
    };
  }, [user]);

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

        {/* Protected routes with shared layout */}
        <Route path="/">
          <ProtectedRoute>
            <Layout>
              <QueueView />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/library">
          <ProtectedRoute>
            <Layout>
              <LibraryView />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/search">
          <ProtectedRoute>
            <Layout>
              <SearchView />
            </Layout>
          </ProtectedRoute>
        </Route>
      </Switch>
    </div>
  );
};
