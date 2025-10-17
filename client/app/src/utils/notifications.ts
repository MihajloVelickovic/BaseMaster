export type NotificationType = 
  | 'FRIEND_REQUEST' 
  | 'FRIEND_ACCEPT' 
  | 'FRIEND_DENY'
  | 'FRIEND_REMOVED' 
  | 'GAME_RESULT' 
  | 'GAME_INVITE'
  | 'GENERAL'
  | 'ACHIEVEMENT_UNLOCKED';

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
  fullResults?: Array<{
    username: string;
    score: number;
    placement: number;
  }>;
  achievement?: {
    code: string;
    name: string;
    description: string;
    type: string;
  };
};  
}

export interface NotificationState {
  notifications: INotification[];
  unreadCount: number;
}

export {};