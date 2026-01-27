/**
 * Authentication service for login, register, and token management
 */

import { getConfigSync } from './config';

const TOKEN_KEY = 'musakone_token';

function getBackendUrl(): string {
    return getConfigSync().backendHttpUrl;
}

export interface User {
    id: number;
    username: string;
    created_at: number;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface RegisterResponse {
    id: number;
    username: string;
    created_at: number;
}

/**
 * Register a new user account
 */
export async function register(username: string, password: string): Promise<RegisterResponse> {
    const response = await fetch(`${getBackendUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Login with username and password
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${getBackendUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data: LoginResponse = await response.json();

    // Store token in localStorage
    localStorage.setItem(TOKEN_KEY, data.token);

    return data;
}

/**
 * Logout and clear token
 */
export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
    return getToken() !== null;
}

/**
 * Get current user info from backend
 */
export async function getCurrentUser(): Promise<User> {
    const token = getToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${getBackendUrl()}/api/auth/me`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            logout(); // Clear invalid token
        }
        throw new Error('Failed to get user info');
    }

    return response.json();
}
