export type NotificationType = 
  | 'FRIEND_REQUEST' 
  | 'FRIEND_ACCEPTED' 
  | 'FRIEND_DECLINED' 
  | 'GAME_RESULT' 
  | 'GAME_INVITE'
  | 'GENERAL';

export interface Notification {
  id: string;
  type: NotificationType;
  from?: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionData?: {
    gameId?: string;
    place?: number;
    score?: number;
    totalPlayers?: number;
  };
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

export {};