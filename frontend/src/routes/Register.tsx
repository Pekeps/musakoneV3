import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { useLocation } from 'wouter';
import { register, login } from '../services/auth';
import { setUser, setAuthLoading, setAuthError, authLoading, authError } from '../stores/auth';
import styles from './Login.module.css'; // Reuse same styles

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const loading = useStore(authLoading);
  const error = useStore(authError);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setAuthError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      // Register user
      await register(username, password);
      
      // Auto-login after registration
      const response = await login(username, password);
      setUser(response.user);
      setLocation('/'); // Redirect to home after registration
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div class={styles.loginContainer}>
      <div class={styles.loginBox}>
        <h1 class={styles.title}>MusakoneV3</h1>
        <p class={styles.subtitle}>Create new account</p>

        {error && (
          <div class={styles.error}>{error}</div>
        )}

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
              placeholder="Choose username"
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
              placeholder="Choose password"
              disabled={loading}
              autocomplete="new-password"
            />
          </div>

          <div class={styles.formGroup}>
            <label class={styles.label} for="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              class={styles.input}
              value={confirmPassword}
              onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
              placeholder="Repeat password"
              disabled={loading}
              autocomplete="new-password"
            />
          </div>

          <button
            type="submit"
            class={styles.button}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p class={styles.link}>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
