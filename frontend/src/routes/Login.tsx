import { useStore } from '@nanostores/preact';
import { useState } from 'preact/hooks';
import { useLocation } from 'wouter';
import { login } from '../services/auth';
import { authError, authLoading, setAuthError, setAuthLoading, setUser } from '../stores/auth';
import styles from './Login.module.css';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const loading = useStore(authLoading);
    const error = useStore(authError);
    const [, setLocation] = useLocation();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!username.trim() || !password.trim()) {
            setAuthError('Username and password are required');
            return;
        }

        setAuthLoading(true);
        setAuthError(null);

        try {
            const response = await login(username, password);
            setUser(response.user);
            setLocation('/'); // Redirect to home after login
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <div class={styles.loginContainer}>
            <div class={styles.loginBox}>
                <h1 class={styles.title}>MusakoneV3</h1>
                <p class={styles.subtitle}>Sign in to continue</p>

                {error && <div class={styles.error}>{error}</div>}

                <form class={styles.form} onSubmit={handleSubmit}>
                    <div class={styles.formGroup}>
                        <label class={styles.label} for="username">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            class={styles.input}
                            value={username}
                            onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                            placeholder="Enter username"
                            disabled={loading}
                            autocomplete="username"
                        />
                    </div>

                    <div class={styles.formGroup}>
                        <label class={styles.label} for="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            class={styles.input}
                            value={password}
                            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                            placeholder="Enter password"
                            disabled={loading}
                            autocomplete="current-password"
                        />
                    </div>

                    <button type="submit" class={styles.button} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p class={styles.link}>
                    Don't have an account? <a href="/register">Create one</a>
                </p>
            </div>
        </div>
    );
}
