import React, { useState } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { Notification } from '../utils/notifications';
import { formatTimeAgo } from '../utils/notificationHelpers';
import '../styles/NotificationDropdown.css';

interface NotificationDropdownProps {
    notifications: Notification[];
    friendRequests: string[];
    onAcceptRequest: (username: string) => void;
    onDeclineRequest: (username: string) => void;
    onDismiss: (id: string) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
    notifications,
    friendRequests,
    onAcceptRequest,
    onDeclineRequest,
    onDismiss
}) => {
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

    // Separate notifications by type
    const gameResultNotifications = notifications.filter(n => n.type === 'GAME_RESULT');
    const friendResponseNotifications = notifications.filter(n => 
        n.type === 'FRIEND_ACCEPTED' || n.type === 'FRIEND_DECLINED'
    );
    
    const hasAnyNotifications = notifications.length > 0 || friendRequests.length > 0;

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

    const renderGameResult = (notification: Notification) => {
        const { place, score, totalPlayers } = notification.actionData || {};
        const isExpanded = expandedResults.has(notification.id);
        let medalEmoji = '';
        
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
                            <span className="stat-value place">{place}/{totalPlayers}</span>
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
                        {isExpanded ? '▼ Show Less' : '▶ View Details'}
                    </button>

                    {isExpanded && notification.actionData && (
                        <div className="game-result-expanded">
                            <pre className="result-data">
                                {JSON.stringify(notification.actionData, null, 2)}
                            </pre>
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

    const renderFriendResponse = (notification: Notification) => {
        const icon = notification.type === 'FRIEND_ACCEPTED' ? '✅' : '❌';
        const color = notification.type === 'FRIEND_ACCEPTED' ? '#10b981' : '#ef4444';

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
                {hasAnyNotifications && (
                    <span className="notification-count">
                        {friendRequests.length + notifications.length}
                    </span>
                )}
            </div>

            {!hasAnyNotifications ? (
                <div className="empty-state">
                    <div className="empty-icon">🔔</div>
                    <p>No new notifications</p>
                </div>
            ) : (
                <div className="notification-list">
                    {friendRequests.length > 0 && (
                        <div className="notification-section">
                            <div className="section-title">Friend Requests</div>
                            {friendRequests.map((username, index) => renderFriendRequest(username, index))}
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
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;