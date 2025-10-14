// components/NotificationCenter.tsx
import { FaCheck, FaTimes, FaBell } from "react-icons/fa";
import "../styles/NotificationCenter.css";
import { NotificationType, Notification } from "../utils/types";


interface NotificationCenterProps {
  isOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  onToggle: () => void;
  onAcceptFriendRequest: (username: string) => void;
  onDeclineFriendRequest: (username: string) => void;
  onCloseGameResult: (notificationId: string) => void;
}

const NotificationCenter = ({
  isOpen,
  notifications,
  unreadCount,
  onToggle,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onCloseGameResult
}: NotificationCenterProps) => {
  
  const renderNotification = (notification: Notification) => {
    switch (notification.type) {
      case NotificationType.FRIEND_REQUEST:
        return (
          <div key={notification.id} className="notification-item friend-request">
            <span>Friend request from {notification.from}</span>
            <div className="notification-actions">
              <button 
                onClick={() => onAcceptFriendRequest(notification.from)}
                className="btn-accept"
              >
                <FaCheck />
              </button>
              <button 
                onClick={() => onDeclineFriendRequest(notification.from)}
                className="btn-decline"
              >
                <FaTimes />
              </button>
            </div>
          </div>
        );

      case NotificationType.FRIEND_ACCEPTED:
      case NotificationType.FRIEND_DECLINED:
        return (
          <div key={notification.id} className="notification-item friend-response">
            <span>{notification.message}</span>
          </div>
        );

      case NotificationType.GAME_RESULT:
        return (
          <div key={notification.id} className="notification-item game-result">
            <h4>Game Results</h4>
            <div className="mini-scoreboard">
              {notification.scoreboard.map((player) => (
                <div key={player.username} className="scoreboard-entry">
                  <span className="placement">#{player.placement}</span>
                  <span className="username">{player.username}</span>
                  <span className="score">{player.score}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => onCloseGameResult(notification.id)}
              className="btn-close"
            >
              Close
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="notification-center">
      <div className="bell-wrapper">
        <FaBell onClick={onToggle} className="bell-icon" />
        {unreadCount > 0 && (
          <div className="notification-badge">{unreadCount}</div>
        )}
      </div>

      {isOpen && (
        <div className="notification-dropdown">
          {notifications.length === 0 ? (
            <div className="empty-notifications">
              <span>No new notifications</span>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map(renderNotification)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;