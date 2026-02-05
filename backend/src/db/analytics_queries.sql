-- Analytics queries for user action tracking
-- Shows "who did what" based on the three event tables

-- =============================================================================
-- PLAYBACK EVENTS: What users played, paused, skipped, etc.
-- =============================================================================

-- Recent playback activity by all users (last 24 hours)
SELECT
    u.username,
    pe.event_type,
    pe.track_name,
    pe.artist_name,
    datetime(pe.timestamp_ms / 1000, 'unixepoch') as event_time,
    printf('%.1f', pe.position_ms / 1000.0) || 's' as position,
    CASE
        WHEN pe.volume_level IS NOT NULL THEN pe.volume_level || '%'
        ELSE NULL
    END as volume,
    pe.playback_flags
FROM playback_events pe
JOIN users u ON pe.user_id = u.id
WHERE pe.timestamp_ms > (strftime('%s', 'now') * 1000) - (24 * 60 * 60 * 1000)
ORDER BY pe.timestamp_ms DESC
LIMIT 50;

-- What each user played most recently
SELECT
    u.username,
    pe.event_type,
    pe.track_name || ' - ' || pe.artist_name as track,
    datetime(pe.timestamp_ms / 1000, 'unixepoch') as when_played
FROM playback_events pe
JOIN users u ON pe.user_id = u.id
WHERE pe.event_type IN ('play', 'resume')
ORDER BY pe.timestamp_ms DESC;

-- User playback patterns: most active users by event count
SELECT
    u.username,
    COUNT(*) as total_events,
    COUNT(CASE WHEN pe.event_type = 'play' THEN 1 END) as plays,
    COUNT(CASE WHEN pe.event_type = 'pause' THEN 1 END) as pauses,
    COUNT(CASE WHEN pe.event_type = 'next' THEN 1 END) as skips,
    COUNT(CASE WHEN pe.event_type = 'seek' THEN 1 END) as seeks,
    COUNT(CASE WHEN pe.event_type = 'volume' THEN 1 END) as volume_changes
FROM playback_events pe
JOIN users u ON pe.user_id = u.id
GROUP BY u.id, u.username
ORDER BY total_events DESC;

-- =============================================================================
-- QUEUE EVENTS: What users added/removed from queue
-- =============================================================================

-- Recent queue activity (last 24 hours)
SELECT
    u.username,
    qe.event_type,
    qe.track_names,
    CASE
        WHEN qe.at_position IS NOT NULL THEN 'at position ' || qe.at_position
        WHEN qe.from_position IS NOT NULL AND qe.to_position IS NOT NULL
            THEN 'from ' || qe.from_position || ' to ' || qe.to_position
        ELSE NULL
    END as position_info,
    qe.queue_length,
    datetime(qe.timestamp_ms / 1000, 'unixepoch') as event_time
FROM queue_events qe
JOIN users u ON qe.user_id = u.id
WHERE qe.timestamp_ms > (strftime('%s', 'now') * 1000) - (24 * 60 * 60 * 1000)
ORDER BY qe.timestamp_ms DESC
LIMIT 50;

-- Queue management patterns by user
SELECT
    u.username,
    COUNT(*) as total_queue_actions,
    COUNT(CASE WHEN qe.event_type = 'add' THEN 1 END) as tracks_added,
    COUNT(CASE WHEN qe.event_type = 'remove' THEN 1 END) as tracks_removed,
    COUNT(CASE WHEN qe.event_type = 'clear' THEN 1 END) as queue_clears,
    COUNT(CASE WHEN qe.event_type = 'shuffle' THEN 1 END) as shuffles,
    COUNT(CASE WHEN qe.event_type = 'move' THEN 1 END) as track_moves,
    AVG(qe.queue_length) as avg_queue_length
FROM queue_events qe
JOIN users u ON qe.user_id = u.id
GROUP BY u.id, u.username
ORDER BY total_queue_actions DESC;

-- =============================================================================
-- SEARCH EVENTS: What users searched for and browsed
-- =============================================================================

-- Recent search and browse activity (last 24 hours)
SELECT
    u.username,
    se.event_type,
    CASE
        WHEN se.event_type = 'query' THEN se.query_text
        WHEN se.event_type = 'browse' THEN se.browse_uri
        ELSE NULL
    END as search_term,
    se.result_count,
    datetime(se.timestamp_ms / 1000, 'unixepoch') as event_time
FROM search_events se
JOIN users u ON se.user_id = u.id
WHERE se.timestamp_ms > (strftime('%s', 'now') * 1000) - (24 * 60 * 60 * 1000)
ORDER BY se.timestamp_ms DESC
LIMIT 50;

-- Search patterns by user
SELECT
    u.username,
    COUNT(*) as total_searches,
    COUNT(CASE WHEN se.event_type = 'query' THEN 1 END) as text_searches,
    COUNT(CASE WHEN se.event_type = 'browse' THEN 1 END) as browses,
    AVG(se.result_count) as avg_results,
    GROUP_CONCAT(DISTINCT se.query_text) as recent_queries
FROM search_events se
JOIN users u ON se.user_id = u.id
WHERE se.query_text IS NOT NULL
GROUP BY u.id, u.username
ORDER BY total_searches DESC;

-- =============================================================================
-- COMBINED ACTIVITY: Timeline of all user actions
-- =============================================================================

-- Complete activity timeline (last hour, all event types)
SELECT
    'playback' as event_category,
    u.username,
    pe.event_type,
    pe.track_name as details,
    datetime(pe.timestamp_ms / 1000, 'unixepoch') as event_time,
    pe.timestamp_ms
FROM playback_events pe
JOIN users u ON pe.user_id = u.id
WHERE pe.timestamp_ms > (strftime('%s', 'now') * 1000) - (60 * 60 * 1000)

UNION ALL

SELECT
    'queue' as event_category,
    u.username,
    qe.event_type,
    qe.track_names as details,
    datetime(qe.timestamp_ms / 1000, 'unixepoch') as event_time,
    qe.timestamp_ms
FROM queue_events qe
JOIN users u ON qe.user_id = u.id
WHERE qe.timestamp_ms > (strftime('%s', 'now') * 1000) - (60 * 60 * 1000)

UNION ALL

SELECT
    'search' as event_category,
    u.username,
    se.event_type,
    CASE
        WHEN se.event_type = 'query' THEN se.query_text
        WHEN se.event_type = 'browse' THEN se.browse_uri
        ELSE NULL
    END as details,
    datetime(se.timestamp_ms / 1000, 'unixepoch') as event_time,
    se.timestamp_ms
FROM search_events se
JOIN users u ON se.user_id = u.id
WHERE se.timestamp_ms > (strftime('%s', 'now') * 1000) - (60 * 60 * 1000)

ORDER BY timestamp_ms DESC
LIMIT 100;

-- =============================================================================
-- USER BEHAVIOR INSIGHTS
-- =============================================================================

-- Most active users overall
SELECT
    u.username,
    COUNT(*) as total_actions,
    COUNT(DISTINCT CASE WHEN pe.id IS NOT NULL THEN date(pe.timestamp_ms / 1000, 'unixepoch') END) as active_days,
    AVG(CASE WHEN pe.event_type IN ('play', 'resume') THEN pe.track_duration_ms END) as avg_track_length_ms
FROM users u
LEFT JOIN playback_events pe ON u.id = pe.user_id
LEFT JOIN queue_events qe ON u.id = qe.user_id
LEFT JOIN search_events se ON u.id = se.user_id
GROUP BY u.id, u.username
HAVING total_actions > 0
ORDER BY total_actions DESC;

-- Popular tracks (most played across all users)
SELECT
    pe.track_name,
    pe.artist_name,
    COUNT(*) as play_count,
    COUNT(DISTINCT pe.user_id) as unique_users,
    AVG(pe.track_duration_ms) as avg_duration_ms
FROM playback_events pe
WHERE pe.event_type IN ('play', 'resume')
AND pe.track_name IS NOT NULL
GROUP BY pe.track_uri, pe.track_name, pe.artist_name
ORDER BY play_count DESC
LIMIT 20;

-- Search trends (most searched terms)
SELECT
    se.query_text,
    COUNT(*) as search_count,
    COUNT(DISTINCT se.user_id) as unique_users,
    AVG(se.result_count) as avg_results
FROM search_events se
WHERE se.event_type = 'query'
AND se.query_text IS NOT NULL
GROUP BY se.query_text
ORDER BY search_count DESC
LIMIT 20;