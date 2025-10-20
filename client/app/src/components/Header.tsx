import { Link, useLocation } from "react-router-dom";
import "../styles/Header.css"
import Sidebar from "./Sidebar";
import { FaBell, FaCheck, FaTimes } from "react-icons/fa";
import { useEffect, useRef, useState, useCallback } from "react";
import axiosInstance from "../utils/axiosInstance";
import { useFriendContext } from "../utils/FriendContext"
import { useLobbyContext } from "../utils/LobbyContext";
import { GiCrossedSwords } from "react-icons/gi";
import { useAuth } from "../utils/AuthContext";
import { INotification, NotificationType } from "../utils/notifications";
import { createNotification, getOrdinalSuffix } from '../utils/notificationHelpers'
import Notification from './Notification';
import React from "react";
import { useWebSocket } from "../utils/WebSocketContext";

function Header() {
    type Invite = {
        message: string;
        gameId: string;
    };
    
    const { playerID, logout } = useAuth();
    const [isOpenNotification, setIsOpenNotification] = useState(false);
    const { friendRequests, setFriends, setFriendRequests, setOnlineUsers } = useFriendContext();
    const [notifications, setNotifications] = useState<INotification[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [showInvites, setShowInvites] = useState(false);
    const location = useLocation();
    const { joinLobby, setPlayerID: setLobbyPlayerID } = useLobbyContext();
    const processedNotifications = useRef<Set<string>>(new Set());
    const { subscribe, unsubscribe } = useWebSocket();
    // Calculate unread count from notifications
    const uniqueFriendRequests = Array.from(new Set(friendRequests));
    const uniqueUnreadNotifications = React.useMemo(() => {
        const seen = new Map<string, INotification>();
        notifications
            .filter(n => !n.read && n.type !== 'FRIEND_REQUEST') // Exclude FRIEND_REQUEST - already counted in friendRequests
            .forEach(notification => {
                const key = notification.type === 'GAME_RESULT'
                    ? `${notification.type}-${notification.actionData?.place}-${notification.actionData?.score}`
                    : `${notification.type}-${notification.from || ''}`;
                if (!seen.has(key)) {
                    seen.set(key, notification);
                }
            });
        return Array.from(seen.values());
    }, [notifications]);

const unreadCount = uniqueFriendRequests.length + uniqueUnreadNotifications.length;

    useEffect(() => {
        if (playerID) {
            setLobbyPlayerID(playerID);
        }
    }, [playerID, setLobbyPlayerID]);

    // Message handlers using useCallback to maintain stable references
    const handleFriendRequest = useCallback((data: any) => {
        console.log('Received FRIEND_REQUEST:', data);
        const key = getNotificationKey('FRIEND_REQUEST', data.from);

        if (processedNotifications.current.has(key)) {
            console.log('Duplicate FRIEND_REQUEST ignored:', data.from);
            return;
        }
        processedNotifications.current.add(key);

        setFriendRequests((prev) => {
            if (prev.includes(data.from)) return prev;
            return [...prev, data.from];
        });

        setNotifications((prev) => [
            createNotification('FRIEND_REQUEST', `Friend request from ${data.from}`, data.from),
            ...prev
        ]);
    }, [setFriendRequests, setNotifications]);

    const handleFriendAccept = useCallback(async (data: any) => {
        const key = getNotificationKey('FRIEND_ACCEPT', data.from);

        if (processedNotifications.current.has(key)) {
            console.log('Duplicate FRIEND_ACCEPT ignored:', data.from);
            return;
        }
        processedNotifications.current.add(key);

        setFriends((prev) => {
            if (prev.includes(data.from)) return prev;
            return [...prev, data.from];
        });

        // Re-fetch friends list to get updated online status
        if (playerID) {
            try {
                const response = await axiosInstance.post('/user/getFriends', { username: playerID });
                const onlineFriends = response.data.onlineFriends || [];
                setOnlineUsers(onlineFriends);
                console.log('[Header] Refreshed online friends after FRIEND_ACCEPT:', onlineFriends);
            } catch (error) {
                console.error('[Header] Failed to refresh online friends:', error);
            }
        }

        setNotifications((prev) => [
            createNotification('FRIEND_ACCEPT', `${data.from} accepted your friend request`, data.from),
            ...prev
        ]);
    }, [playerID, setOnlineUsers]);

    const handleFriendDeny = useCallback((data: any) => {
        const key = getNotificationKey('FRIEND_DENY', data.from);

        if (processedNotifications.current.has(key)) {
            console.log('Duplicate FRIEND_DENY ignored:', data.from);
            return;
        }
        processedNotifications.current.add(key);

        setNotifications((prev) => [
            createNotification('FRIEND_DENY', `${data.from} declined your friend request`, data.from),
            ...prev
        ]);
    }, []);

    const handleFriendRemoved = useCallback((data: any) => {
        const key = getNotificationKey('FRIEND_REMOVED', data.from);

        if (processedNotifications.current.has(key)) {
            console.log('Duplicate FRIEND_REMOVED ignored:', data.from);
            return;
        }
        processedNotifications.current.add(key);

        setFriends((prev) => prev.filter(friend => friend !== data.from));

        setNotifications((prev) => [
            createNotification('FRIEND_REMOVED', data.message, data.from),
            ...prev
        ]);
    }, []);

    const handleUserOnline = useCallback((data: any) => {
        console.log('[Header] Received USER_ONLINE:', data.username);
        setOnlineUsers((prev) => {
            if (!prev.includes(data.username)) {
                console.log('[Header] Adding user to online list:', data.username);
                return [...prev, data.username];
            }
            return prev;
        });
    }, [setOnlineUsers]);

    const handleUserOffline = useCallback((data: any) => {
        console.log('[Header] Received USER_OFFLINE:', data.username);
        setOnlineUsers((prev) => {
            console.log('[Header] Removing user from online list:', data.username);
            return prev.filter(name => name !== data.username);
        });
    }, [setOnlineUsers]);

    const handleOnlineFriends = useCallback((data: any) => {
        console.log('[Header] Received ONLINE_FRIENDS:', data.friends);
        setOnlineUsers(data.friends);
    }, [setOnlineUsers]);

    const handleInvite = useCallback((data: any) => {
        setInvites((prev) => {
            const exists = prev.some(inv => inv.gameId === data.gameId);
            if (exists) return prev;
            return [...prev, {
                message: data.message,
                gameId: data.gameId
            }];
        });
    }, []);

    const handleGameResult = useCallback((data: any) => {
        const { place, score, totalPlayers, fullResults } = data.actionData;
        const key = getNotificationKey('GAME_RESULT', undefined, { place, score, totalPlayers });

        if (processedNotifications.current.has(key)) {
            console.log('Duplicate GAME_RESULT ignored:', place, score);
            return;
        }
        processedNotifications.current.add(key);

        setNotifications((prev) => [
            createNotification(
                'GAME_RESULT',
                `You placed ${place}${getOrdinalSuffix(place)} with ${score} points!`,
                undefined,
                { place, score, totalPlayers, fullResults }
            ),
            ...prev
        ]);
    }, []);

    const handleAchievementUnlocked = useCallback((data: any) => {
        const { name, description, code, type } = data.actionData;
        const key = getNotificationKey('ACHIEVEMENT_UNLOCKED', undefined, { name, code });

        if (processedNotifications.current.has(key)) {
            console.log('Duplicate ACHIEVEMENT_UNLOCKED ignored:', name);
            return;
        }
        processedNotifications.current.add(key);

        setNotifications((prev) => [
            createNotification(
                'ACHIEVEMENT_UNLOCKED',
                `Achievement Unlocked: ${name}`,
                undefined,
                { achievement: { name, description, code, type } }
            ),
            ...prev
        ]);
    }, []);

    // Subscribe to WebSocket messages
    useEffect(() => {
        subscribe('FRIEND_REQUEST', handleFriendRequest);
        subscribe('FRIEND_ACCEPT', handleFriendAccept);
        subscribe('FRIEND_DENY', handleFriendDeny);
        subscribe('FRIEND_REMOVED', handleFriendRemoved);
        subscribe('USER_ONLINE', handleUserOnline);
        subscribe('USER_OFFLINE', handleUserOffline);
        subscribe('ONLINE_FRIENDS', handleOnlineFriends);
        subscribe('INVITE', handleInvite);
        subscribe('GAME_RESULT', handleGameResult);
        subscribe('ACHIEVEMENT_UNLOCKED', handleAchievementUnlocked);

        return () => {
            unsubscribe('FRIEND_REQUEST', handleFriendRequest);
            unsubscribe('FRIEND_ACCEPT', handleFriendAccept);
            unsubscribe('FRIEND_DENY', handleFriendDeny);
            unsubscribe('FRIEND_REMOVED', handleFriendRemoved);
            unsubscribe('USER_ONLINE', handleUserOnline);
            unsubscribe('USER_OFFLINE', handleUserOffline);
            unsubscribe('ONLINE_FRIENDS', handleOnlineFriends);
            unsubscribe('INVITE', handleInvite);
            unsubscribe('GAME_RESULT', handleGameResult);
            unsubscribe('ACHIEVEMENT_UNLOCKED', handleAchievementUnlocked);
        };
    }, [subscribe, unsubscribe, handleFriendRequest, handleFriendAccept, handleFriendDeny, handleFriendRemoved, handleUserOnline, handleUserOffline, handleOnlineFriends, handleInvite, handleGameResult, handleAchievementUnlocked]);

    // Add this after: const unreadCount = friendRequests.length + notifications.filter(n => !n.read).length;

const getNotificationKey = (type: string, from?: string, actionData?: any) => {
    if (type === 'GAME_RESULT' && actionData) {
        return `${type}-${actionData.place}-${actionData.score}-${actionData.totalPlayers}`;
    }
    return `${type}-${from || ''}-${Date.now()}`;
};

    useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        // Check if click is outside the bell container
        if (isOpenNotification && !target.closest('.bell-container')) {
            setIsOpenNotification(false);
        }
    };

        if (isOpenNotification) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpenNotification]);

    const handleInviteIconClick = () => {
        setShowInvites(prev => !prev);
    };

    // Add this after: const unreadCount = friendRequests.length + notifications.filter(n => !n.read).length;

    const removeInvite = (gameId: string) => {
        setInvites(prev => prev.filter(inv => inv.gameId !== gameId));
        setShowInvites(false);
    };

    const handleNotificationBtnClick = async () => {
    const willBeOpen = !isOpenNotification;
    
    setIsOpenNotification(willBeOpen);
   
    // Mark all as read when opening (not closing!)
    if (willBeOpen) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
   
    // Fetch friend requests from server only when opening
    if (willBeOpen) {
        try {
            const response = await axiosInstance.post('/user/friendRequests', { username: playerID });
            setFriendRequests(response.data.requests);
        } catch (err: any) {
            console.log(err.message);
        }
    }
};
   const handleRequestSelection = async (username: string, selection: boolean) => {
    try {
        const response = await axiosInstance.post('/user/handleFriendRequest', {
            username: playerID,
            sender: username,
            userResponse: selection
        });
        
        if (selection === true) {
            setFriends(prev => [...prev, username]); 
            console.log("SUCCESSFULLY BECAME FRIENDS!!!!!!");
        }
    } catch (err: any) {
        if (err.response) {
            console.error("Server responded with error:", err.response.status, err.response.data);
        } else {
            console.error("Request error:", err.message);
        }
    } finally {
        setFriendRequests((prev) => prev.filter((req) => req !== username));
    
        // Remove the friend request notification and clean up processed set
        setNotifications(prev => {
            const notification = prev.find(n => n.type === 'FRIEND_REQUEST' && n.from === username);
            if (notification) {
                const key = getNotificationKey('FRIEND_REQUEST', username);
                processedNotifications.current.delete(key);
            }
            return prev.filter(n => !(n.type === 'FRIEND_REQUEST' && n.from === username));
        });
    }
};

    const handleDismissNotification = (id: string) => {
    setNotifications(prev => {
        const notification = prev.find(n => n.id === id);
        if (notification) {
            const key = getNotificationKey(
                notification.type, 
                notification.from, 
                notification.actionData
            );
            processedNotifications.current.delete(key);
        }
        return prev.filter(n => n.id !== id);
    });
};

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const handleClearAllNotifications = () => {
        setNotifications(prev => {
            const clearedNotifications = prev.filter(n => n.type === 'FRIEND_REQUEST');
            
            prev.forEach(notification => {
                if (notification.type !== 'FRIEND_REQUEST') {
                    const key = getNotificationKey(
                        notification.type,
                        notification.from,
                        notification.actionData
                    );
                    processedNotifications.current.delete(key);
                }
            });
            
            return clearedNotifications;
        });
    };

    const handleLogout = async () => {
        // WebSocket context handles LOGOUT message automatically
        await logout();
        localStorage.removeItem("accessTok");
        localStorage.removeItem("refreshTok");
        window.location.href = '/LoginSignup';
    };

    return (
        <div className="Header">
            <Link to="/" className="logo-link">
                <svg className="basemaster-logo" width="260" height="60" viewBox="0 0 260 60" xmlns="http://www.w3.org/2000/svg">
                    <path className="circuit-line" d="M 10 5 L 30 5 Q 40 5 40 15 L 40 45 Q 40 55 50 55 L 210 55 Q 220 55 220 45 L 220 15 Q 220 5 230 5 L 250 5" />
                    <text x="20" y="19" className="binary-digit">01</text>
                    <text x="225" y="48" className="binary-digit">10</text>
                    <text x="50" y="51" className="binary-digit">110</text>
                    <text x="190" y="15" className="binary-digit">001</text>
                    <text x="50%" y="50%" className="logo-text">BaseMaster</text>
                </svg>
            </Link>

            <nav className="header-nav">
                <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                    Play
                </Link>
                <Link to="/Leaderboard" 
                    state={{ username: playerID }}
                    className={`nav-link ${isActive('/Leaderboard') ? 'active' : ''}`}>
                    Leaderboard
                </Link>
            </nav>

            <div className="spacer" />
            
            {!playerID ? (
                <Link to="/LoginSignup">
                    <button className="login-button btn btn-primary">Log in</button>
                </Link>
            ) : (
                <>
                    <div className="header-info">
                        <div className="bell-container">
                            <div className="bell-wrapper">
                                <FaBell onClick={handleNotificationBtnClick} className="bell-icon" />
                                {unreadCount > 0 && (
                                    <div className="notification-badge">{unreadCount}</div>
                                )}
                            </div>
                            {isOpenNotification && (
                                <Notification
                                    notifications={notifications}
                                    friendRequests={friendRequests}
                                    onAcceptRequest={(username) => handleRequestSelection(username, true)}
                                    onDeclineRequest={(username) => handleRequestSelection(username, false)}
                                    onDismiss={handleDismissNotification}
                                    onClearAll={handleClearAllNotifications}
                                />
                            )}
                        </div>

                        <div className="bell-wrapper">
                            {invites.length > 0 ? (
                                <GiCrossedSwords
                                    className="InviteIcon pulsing-sword flippedIconVertical"
                                    onClick={handleInviteIconClick}
                                />
                            ) : (
                                <GiCrossedSwords className="InviteIcon flippedIconVertical" />
                            )}
                        </div>
                        <Sidebar onLogout={handleLogout} />
                    </div>
                </>
            )}

            {showInvites && invites.length > 0 && (
                <div className="invite-dropdown">
                    {invites.map((invite, index) => (
                        <div key={index} className="invitationItem">
                            <span>{invite.message}</span>
                            <button
                                onClick={() => {
                                    joinLobby(invite.gameId, false); 
                                    removeInvite(invite.gameId);
                                }}
                                className="btn btn-sm btn-success"
                            >
                                Join
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Header;