import { useStore } from '@nanostores/preact';
import { useEffect } from 'preact/hooks';
import { Route, Switch } from 'wouter';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AnalyticsView } from './routes/AnalyticsView';
import { LibraryView } from './routes/LibraryView';
import { Login } from './routes/Login';
import { QueueView } from './routes/QueueView';
import { Register } from './routes/Register';
import { SearchView } from './routes/SearchView';
import { getCurrentUser, isAuthenticated, logout } from './services/auth';
import * as mopidy from './services/mopidy';
import { currentUser, setAuthLoading, setUser } from './stores/auth';

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
        <div className="min-h-screen flex flex-col bg-bg-secondary text-fg-primary font-mono">
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

                <Route path="/analytics">
                    <ProtectedRoute>
                        <Layout>
                            <AnalyticsView />
                        </Layout>
                    </ProtectedRoute>
                </Route>
            </Switch>
        </div>
    );
};
