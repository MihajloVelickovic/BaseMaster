// types/notifications.ts
export enum NotificationType {
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  FRIEND_DECLINED = 'FRIEND_DECLINED',
  GAME_RESULT = 'GAME_RESULT'
}

export interface BaseNotification {
  id: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
}

export interface FriendRequestNotification extends BaseNotification {
  type: NotificationType.FRIEND_REQUEST;
  from: string;
}

export interface FriendResponseNotification extends BaseNotification {
  type: NotificationType.FRIEND_ACCEPTED | NotificationType.FRIEND_DECLINED;
  from: string;
  message: string;
}

export interface GameResultNotification extends BaseNotification {
  type: NotificationType.GAME_RESULT;
  gameId: string;
  scoreboard: {
    username: string;
    score: number;
    placement: number;
  }[];
}

export type Notification = 
  | FriendRequestNotification 
  | FriendResponseNotification 
  | GameResultNotification;