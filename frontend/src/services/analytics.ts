/**
 * Analytics service for fetching user activity data
 */

import { getConfigSync } from './config';
import type { AnalyticsData, UserStats } from '../types';

function getBackendUrl(): string {
    return getConfigSync().backendHttpUrl;
}

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('musakone_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// Admin dashboard types
export interface UserActivity {
    username: string;
    playback_events: number;
    queue_events: number;
    search_events: number;
    total_events: number;
}

export interface HourlyActivity {
    hour: number;
    events: number;
}

export interface PopularTrack {
    name: string;
    artist: string;
    play_count: number;
    unique_users: number;
}

export interface PopularSearch {
    query: string;
    search_count: number;
    unique_users: number;
}

export interface EventDistribution {
    event_type: string;
    count: number;
}

export interface UserWithActivity {
    id: number;
    username: string;
    last_activity: number | null;
    total_events: number;
}

export interface AdminDashboardData {
    user_activity: UserActivity[];
    hourly_activity: HourlyActivity[];
    popular_tracks: PopularTrack[];
    popular_searches: PopularSearch[];
    event_distribution: EventDistribution[];
    users: UserWithActivity[];
    totals: {
        playback: number;
        queue: number;
        search: number;
    };
}

/**
 * Get paginated analytics data (events + counts)
 */
export async function getAnalyticsData(offset = 0, limit = 100): Promise<AnalyticsData> {
    const response = await fetch(
        `${getBackendUrl()}/api/analytics/export?offset=${offset}&limit=${limit}`,
        {
            headers: getAuthHeaders(),
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch analytics' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get user statistics (action counts for current user)
 */
export async function getUserStats(): Promise<UserStats> {
    const response = await fetch(`${getBackendUrl()}/api/analytics/stats`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch stats' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get recent events (last 24 hours)
 */
export async function getRecentEvents(): Promise<AnalyticsData> {
    const response = await fetch(`${getBackendUrl()}/api/analytics/events`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch events' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get comprehensive admin dashboard data (all users)
 */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
    const response = await fetch(`${getBackendUrl()}/api/analytics/admin`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch admin dashboard' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}