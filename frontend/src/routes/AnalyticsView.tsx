import { useEffect, useState } from 'preact/hooks';
import {
    BarChart3,
    Users,
    Music,
    Search,
    TrendingUp,
    Clock,
    Activity,
    User,
    Play,
    List,
    Eye,
    Calendar,
    Zap
} from 'lucide-preact';
import { getAdminDashboard } from '../services/analytics';
import type {
    AdminDashboardData,
    UserActivity,
    HourlyActivity,
    PopularTrack,
    PopularSearch,
    EventDistribution,
    UserWithActivity
} from '../services/analytics';

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: typeof BarChart3;
    color: string;
    subtitle?: string;
}

function MetricCard({ title, value, icon: Icon, color, subtitle }: MetricCardProps) {
    return (
        <div className={`p-4 rounded border border-border-primary bg-bg-secondary ${color} hover:scale-105 transition-transform`}>
            <div className="flex items-center gap-3">
                <Icon className="w-8 h-8 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="text-sm text-fg-secondary truncate">{title}</div>
                    <div className="text-2xl font-bold truncate">{value}</div>
                    {subtitle && <div className="text-xs text-fg-secondary mt-1">{subtitle}</div>}
                </div>
            </div>
        </div>
    );
}

interface UserRowProps {
    user: UserWithActivity;
    rank: number;
}

function UserRow({ user, rank }: UserRowProps) {
    const formatLastActivity = (timestamp: number | null) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    };

    return (
        <tr className="border-b border-border-primary hover:bg-bg-secondary/50">
            <td className="p-3 text-sm font-mono">#{rank}</td>
            <td className="p-3 text-sm font-semibold">{user.username}</td>
            <td className="p-3 text-sm text-center">{user.total_events}</td>
            <td className="p-3 text-sm text-fg-secondary">{formatLastActivity(user.last_activity)}</td>
        </tr>
    );
}

interface TrackRowProps {
    track: PopularTrack;
    rank: number;
}

function TrackRow({ track, rank }: TrackRowProps) {
    return (
        <tr className="border-b border-border-primary hover:bg-bg-secondary/50">
            <td className="p-3 text-sm font-mono">#{rank}</td>
            <td className="p-3 text-sm">
                <div className="font-semibold truncate max-w-xs">{track.name}</div>
                <div className="text-fg-secondary text-xs truncate max-w-xs">{track.artist}</div>
            </td>
            <td className="p-3 text-sm text-center">{track.play_count}</td>
            <td className="p-3 text-sm text-center text-fg-secondary">{track.unique_users}</td>
        </tr>
    );
}

interface SearchRowProps {
    search: PopularSearch;
    rank: number;
}

function SearchRow({ search, rank }: SearchRowProps) {
    return (
        <tr className="border-b border-border-primary hover:bg-bg-secondary/50">
            <td className="p-3 text-sm font-mono">#{rank}</td>
            <td className="p-3 text-sm font-semibold truncate max-w-xs">{search.query}</td>
            <td className="p-3 text-sm text-center">{search.search_count}</td>
            <td className="p-3 text-sm text-center text-fg-secondary">{search.unique_users}</td>
        </tr>
    );
}

interface ActivityChartProps {
    hourlyData: HourlyActivity[];
}

function ActivityChart({ hourlyData }: ActivityChartProps) {
    const maxEvents = Math.max(...hourlyData.map(h => h.events), 1);

    return (
        <div className="bg-bg-secondary rounded border border-border-primary p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                24-Hour Activity
            </h3>
            <div className="flex items-end gap-1 h-32">
                {hourlyData.map((hour) => (
                    <div key={hour.hour} className="flex-1 flex flex-col items-center">
                        <div
                            className="w-full bg-accent-primary rounded-t min-h-2"
                            style={{ height: `${(hour.events / maxEvents) * 100}%` }}
                            title={`${hour.events} events at ${hour.hour}:00`}
                        />
                        <div className="text-xs text-fg-secondary mt-1">{hour.hour}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface EventTypeChartProps {
    distribution: EventDistribution[];
}

function EventTypeChart({ distribution }: EventTypeChartProps) {
    const total = distribution.reduce((sum, d) => sum + d.count, 0);
    const colors = [
        'bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500',
        'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ];

    return (
        <div className="bg-bg-secondary rounded border border-border-primary p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Event Types
            </h3>
            <div className="space-y-3">
                {distribution.slice(0, 8).map((event, index) => (
                    <div key={event.event_type} className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${colors[index % colors.length]}`} />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{event.event_type}</div>
                            <div className="text-xs text-fg-secondary">
                                {event.count} events ({((event.count / total) * 100).toFixed(1)}%)
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function AnalyticsView() {
    const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                setLoading(true);
                const data = await getAdminDashboard();
                setDashboardData(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="text-fg-secondary">Loading admin dashboard...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-400">{error}</div>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="p-6 text-center">
                <div className="text-fg-secondary">No dashboard data available</div>
            </div>
        );
    }

    const totalEvents = dashboardData.totals.playback + dashboardData.totals.queue + dashboardData.totals.search;
    const activeUsers = dashboardData.users.filter(u => u.total_events > 0).length;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto"> 
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-8 h-8" />
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-fg-secondary">Comprehensive system analytics and user insights</p>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Events"
                    value={totalEvents.toLocaleString()}
                    icon={Zap}
                    color="text-yellow-400"
                    subtitle="All user actions"
                />
                <MetricCard
                    title="Active Users"
                    value={activeUsers}
                    icon={Users}
                    color="text-blue-400"
                    subtitle={`${dashboardData.users.length} total registered`}
                />
                <MetricCard
                    title="Playback Events"
                    value={dashboardData.totals.playback.toLocaleString()}
                    icon={Play}
                    color="text-green-400"
                    subtitle="Music interactions"
                />
                <MetricCard
                    title="Queue Events"
                    value={dashboardData.totals.queue.toLocaleString()}
                    icon={List}
                    color="text-purple-400"
                    subtitle="List management"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActivityChart hourlyData={dashboardData.hourly_activity} />
                <EventTypeChart distribution={dashboardData.event_distribution} />
            </div>

            {/* User Activity Table */}
            <div className="bg-bg-secondary rounded border border-border-primary p-4">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    User Activity Rankings
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border-primary">
                                <th className="p-3 text-sm font-semibold">Rank</th>
                                <th className="p-3 text-sm font-semibold">Username</th>
                                <th className="p-3 text-sm font-semibold text-center">Total Events</th>
                                <th className="p-3 text-sm font-semibold">Last Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboardData.users
                                .filter(user => user.total_events > 0)
                                .slice(0, 10)
                                .map((user, index) => (
                                <UserRow key={user.id} user={user} rank={index + 1} />
                            ))}
                        </tbody>
                    </table>
                </div>
                {dashboardData.users.filter(u => u.total_events === 0).length > 0 && (
                    <div className="mt-4 text-sm text-fg-secondary">
                        {dashboardData.users.filter(u => u.total_events === 0).length} users have no activity yet
                    </div>
                )}
            </div>

            {/* Popular Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Popular Tracks */}
                <div className="bg-bg-secondary rounded border border-border-primary p-4">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Music className="w-5 h-5" />
                        Most Played Tracks
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border-primary">
                                    <th className="p-3 text-sm font-semibold">Rank</th>
                                    <th className="p-3 text-sm font-semibold">Track</th>
                                    <th className="p-3 text-sm font-semibold text-center">Plays</th>
                                    <th className="p-3 text-sm font-semibold text-center">Users</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboardData.popular_tracks.map((track, index) => (
                                    <TrackRow key={`${track.name}-${track.artist}`} track={track} rank={index + 1} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Popular Searches */}
                <div className="bg-bg-secondary rounded border border-border-primary p-4">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Most Searched Terms
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border-primary">
                                    <th className="p-3 text-sm font-semibold">Rank</th>
                                    <th className="p-3 text-sm font-semibold">Query</th>
                                    <th className="p-3 text-sm font-semibold text-center">Searches</th>
                                    <th className="p-3 text-sm font-semibold text-center">Users</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboardData.popular_searches.map((search, index) => (
                                    <SearchRow key={search.query} search={search} rank={index + 1} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* System Health */}
            <div className="bg-bg-secondary rounded border border-border-primary p-4">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    System Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                            {dashboardData.event_distribution.filter(e => e.event_type === 'play').reduce((sum, e) => sum + e.count, 0)}
                        </div>
                        <div className="text-sm text-fg-secondary">Play Actions</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                            {dashboardData.event_distribution.filter(e => e.event_type === 'add').reduce((sum, e) => sum + e.count, 0)}
                        </div>
                        <div className="text-sm text-fg-secondary">Queue Additions</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">
                            {dashboardData.event_distribution.filter(e => e.event_type === 'query').reduce((sum, e) => sum + e.count, 0)}
                        </div>
                        <div className="text-sm text-fg-secondary">Search Queries</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">
                            {Math.round(totalEvents / Math.max(activeUsers, 1))}
                        </div>
                        <div className="text-sm text-fg-secondary">Avg Events/User</div>
                    </div>
                </div>
            </div>
        </div>
    );
}