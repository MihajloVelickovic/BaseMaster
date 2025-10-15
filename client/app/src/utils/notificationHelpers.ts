// src/utils/notificationHelpers.ts

import { Notification, NotificationType } from '../utils/notifications';

export function createNotification(
  type: NotificationType,
  message: string,
  from?: string,
  actionData?: any
): Notification {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    from,
    message,
    timestamp: new Date(),
    read: false,
    actionData
  };
}

export function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'FRIEND_REQUEST':
      return '👤';
    case 'FRIEND_ACCEPTED':
      return '✅';
    case 'FRIEND_DECLINED':
      return '❌';
    case 'GAME_RESULT':
      return '🏆';
    case 'GAME_INVITE':
      return '⚔️';
    default:
      return '📬';
  }
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'FRIEND_REQUEST':
      return '#3b82f6'; // blue
    case 'FRIEND_ACCEPTED':
      return '#10b981'; // green
    case 'FRIEND_DECLINED':
      return '#ef4444'; // red
    case 'GAME_RESULT':
      return '#f59e0b'; // amber
    case 'GAME_INVITE':
      return '#8b5cf6'; // purple
    default:
      return '#6b7280'; // gray
  }
}

export {}