import React, { useState } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { INotification } from '../utils/notifications';
import { formatTimeAgo, getOrdinalSuffix } from '../utils/notificationHelpers';
import '../styles/Notification.css';

interface NotificationDropdownProps {
    notifications: INotification[];
    friendRequests: string[];
    onAcceptRequest: (username: string) => void;
    onDeclineRequest: (username: string) => void;
    onDismiss: (id: string) => void;
    onClearAll?: () => void;
}

const Notification: React.FC<NotificationDropdownProps> = ({
    notifications,
    friendRequests,
    onAcceptRequest,
    onDeclineRequest,
    onDismiss,
    onClearAll
}) => {
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
    
    // Deduplicate friend requests (in case of duplicates from context)
    const uniqueFriendRequests = Array.from(new Set(friendRequests));
    
    // Deduplicate notifications by creating unique keys
    const uniqueNotifications = React.useMemo(() => {
        const seen = new Map<string, INotification>();
        
        notifications.forEach(notification => {
            const key = notification.type === 'GAME_RESULT'
                ? `${notification.type}-${notification.actionData?.place}-${notification.actionData?.score}-${notification.actionData?.totalPlayers}`
                : `${notification.type}-${notification.from || ''}-${notification.id}`;
            
            if (!seen.has(key)) {
                seen.set(key, notification);
            }
        });
        
        return Array.from(seen.values());
    }, [notifications]);
    const achievementNotifications = uniqueNotifications.filter(n => n.type === 'ACHIEVEMENT_UNLOCKED');
    // Separate notifications by type using deduplicated array
    const gameResultNotifications = uniqueNotifications.filter(n => n.type === 'GAME_RESULT');
    const friendResponseNotifications = uniqueNotifications.filter(n => 
        n.type === 'FRIEND_ACCEPT' || n.type === 'FRIEND_DENY' || n.type === 'FRIEND_REMOVED'
    );
    
    // Only count notifications that will actually be displayed
    const totalDisplayableNotifications = uniqueFriendRequests.length + 
                                          gameResultNotifications.length + 
                                          friendResponseNotifications.length;
    const hasAnyNotifications = totalDisplayableNotifications > 0;

    const toggleExpand = (id: string) => {
        setExpandedResults(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const renderGameResult = (notification: INotification) => {
    const { place, score, totalPlayers, fullResults } = notification.actionData || {};
    const isExpanded = expandedResults.has(notification.id);
    let medalEmoji = '';
    console.log("ACTION DATA", notification.actionData);
    if (place === 1) medalEmoji = '🥇';
    else if (place === 2) medalEmoji = '🥈';
    else if (place === 3) medalEmoji = '🥉';

    return (
        <div className="notification-item game-result" key={notification.id}>
            <div className="notification-icon game-result-icon">
                {medalEmoji || '🏆'}
            </div>
            <div className="notification-content">
                <div className="notification-header">
                    <span className="notification-title">Game Completed!</span>
                    <button 
                        className="dismiss-btn"
                        onClick={() => onDismiss(notification.id)}
                        aria-label="Dismiss"
                    >
                        <FaTimes />
                    </button>
                </div>
                
                <div className="game-result-compact">
                    <div className="result-stat">
                        <span className="stat-label">Your Place:</span>
                        <span className="stat-value place">{place}{getOrdinalSuffix(place)}</span>
                    </div>
                    <div className="result-stat">
                        <span className="stat-label">Score:</span>
                        <span className="stat-value score">{score}</span>
                    </div>
                </div>

                <button 
                    className="expand-btn"
                    onClick={() => toggleExpand(notification.id)}
                >
                    {isExpanded ? '▼ Show Less' : '▶ View Full Leaderboard'}
                </button>

                {isExpanded && fullResults && (
                    <div className="game-result-expanded">
                        <table className="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fullResults.map((result: any) => (
                                    <tr key={result.username} className={result.placement === place ? 'current-player' : ''}>
                                        <td>
                                            {result.placement === 1 ? '🥇' : 
                                             result.placement === 2 ? '🥈' : 
                                             result.placement === 3 ? '🥉' : 
                                             result.placement}
                                        </td>
                                        <td>{result.username}</td>
                                        <td>{result.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <span className="notification-time">{formatTimeAgo(notification.timestamp)}</span>
            </div>
        </div>
    );
};

    const renderFriendRequest = (username: string, index: number) => {
        return (
            <div className="notification-item friend-request" key={`friend-req-${index}`}>
                <div className="notification-icon friend-request-icon">
                    👤
                </div>
                <div className="notification-content">
                    <div className="notification-header">
                        <span className="notification-title">Friend Request</span>
                    </div>
                    <p className="notification-message">
                        <strong>{username}</strong> wants to be your friend
                    </p>
                    <div className="friend-request-actions">
                        <button 
                            className="action-btn accept-btn"
                            onClick={() => onAcceptRequest(username)}
                        >
                            <FaCheck /> Accept
                        </button>
                        <button 
                            className="action-btn decline-btn"
                            onClick={() => onDeclineRequest(username)}
                        >
                            <FaTimes /> Decline
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAchievement = (notification: INotification) => {
        const achievement = notification.actionData?.achievement;
        
        return (
            <div className="notification-item achievement" key={notification.id}>
                <div className="notification-icon achievement-icon">
                    🏆
                </div>
                <div className="notification-content">
                    <div className="notification-header">
                        <span className="notification-title">Achievement Unlocked!</span>
                        <button 
                            className="dismiss-btn"
                            onClick={() => onDismiss(notification.id)}
                            aria-label="Dismiss"
                        >
                            <FaTimes />
                        </button>
                    </div>
                    <p className="notification-message">
                        <strong>{achievement?.name}</strong>
                    </p>
                    <p className="achievement-description">{achievement?.description}</p>
                    <span className="notification-time">{formatTimeAgo(notification.timestamp)}</span>
                </div>
            </div>
        );
    };


    const renderFriendResponse = (notification: INotification) => {
        let icon = '✅';
        let color = '#10b981';

        if (notification.type === 'FRIEND_DENY') {
            icon = '❌';
            color = '#ef4444';
        } else if (notification.type === 'FRIEND_REMOVED') {
            icon = '💔';
            color = '#be123c';
        }

        return (
            <div className="notification-item" key={notification.id}>
                <div className="notification-icon" style={{ backgroundColor: color }}>
                    {icon}
                </div>
                <div className="notification-content">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">{formatTimeAgo(notification.timestamp)}</span>
                </div>
                <button 
                    className="dismiss-btn"
                    onClick={() => onDismiss(notification.id)}
                    aria-label="Dismiss"
                >
                    <FaTimes />
                </button>
            </div>
        );
    };

    return (
        <div className="notification-dropdown open">
            <div className="notification-header-bar">
            <h3>Notifications</h3>
            <div className="notification-header-actions">
                {hasAnyNotifications && (
                    <>
                        <span className="notification-count">
                            {totalDisplayableNotifications}
                        </span>
                        {(gameResultNotifications.length > 0 || friendResponseNotifications.length > 0) && onClearAll && (
                            <button 
                                className="clear-all-btn"
                                onClick={onClearAll}
                                title="Clear all notifications"
                            >
                                Clear All
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>

            {!hasAnyNotifications ? (
                <div className="empty-state">
                    <div className="empty-icon">🔔</div>
                    <p>No new notifications</p>
                </div>
            ) : (
                <div className="notification-list">
                    {uniqueFriendRequests.length > 0 && (
                        <div className="notification-section">
                            <div className="section-title">Friend Requests</div>
                            {uniqueFriendRequests.map((username, index) => renderFriendRequest(username, index))}
                        </div>
                    )}

                    {gameResultNotifications.length > 0 && (
                        <div className="notification-section">
                            <div className="section-title">Game Results</div>
                            {gameResultNotifications.map(renderGameResult)}
                        </div>
                    )}

                    {friendResponseNotifications.length > 0 && (
                        <div className="notification-section">
                            <div className="section-title">Friend Responses</div>
                            {friendResponseNotifications.map(renderFriendResponse)}
                        </div>
                    )}

                    {achievementNotifications.length > 0 && (
                        <div className="notification-section">
                            <div className="section-title">Achievements</div>
                            {achievementNotifications.map(renderAchievement)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Notification;