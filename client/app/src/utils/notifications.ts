export type NotificationType = 
  | 'FRIEND_REQUEST' 
  | 'FRIEND_ACCEPT' 
  | 'FRIEND_DENY' 
  | 'GAME_RESULT' 
  | 'GAME_INVITE'
  | 'GENERAL';

export interface INotification {
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
  notifications: INotification[];
  unreadCount: number;
}

export {};