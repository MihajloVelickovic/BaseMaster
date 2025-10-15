import { Link, useLocation } from "react-router-dom";
import "../styles/Header.css"
import Sidebar from "./Sidebar";
import { FaBell, FaCheck, FaTimes } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { useFriendContext } from "../utils/FriendContext"
import { useLobbyContext } from "../utils/LobbyContext";
import { GiCrossedSwords } from "react-icons/gi";
import { useAuth } from "../utils/AuthContext";
import { Notification, NotificationType } from "../utils/notifications";
import { createNotification, getOrdinalSuffix } from '../utils/notificationHelpers'
import NotificationDropdown from './NotificationDropdown';

function Header() {
    type Invite = {
        message: string;
        gameId: string;
    };
    
    const { playerID, logout } = useAuth();
    const [isOpenNotification, setIsOpenNotification] = useState(false);
    const { friendRequests, setFriends, setFriendRequests, setOnlineUsers } = useFriendContext();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [showInvites, setShowInvites] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const location = useLocation();
    const { joinLobby, setPlayerID: setLobbyPlayerID } = useLobbyContext();

    // Calculate unread count from notifications
    const unreadCount = friendRequests.length + notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (playerID) {
            setLobbyPlayerID(playerID);
        }
    }, [playerID, setLobbyPlayerID]);

    useEffect(() => {
        if (!playerID) return;
    
        const socket = new WebSocket("ws://localhost:1738/");
        socketRef.current = socket;
        
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: "login",
                username: playerID
            }));
        };
    
        socket.onmessage = (event) => {
            console.log('Notifications:', notifications);
    console.log('Unread count:', unreadCount);
            const data = JSON.parse(event.data);
            console.log("Received from WebSocket:", data);
        
            if (data.type === "FRIEND_REQUEST") {
                setFriendRequests((prev) => [...prev, data.from]);
                setNotifications((prev) => [
                    createNotification('FRIEND_REQUEST', `Friend request from ${data.from}`, data.from),
                    ...prev
                ]);
            }
            
            if (data.type === "FRIEND_ACCEPTED") {
                setFriends((prev) => [...prev, data.from]);
                setNotifications((prev) => [
                    createNotification('FRIEND_ACCEPTED', `${data.from} accepted your friend request`, data.from),
                    ...prev
                ]);
            }
            
            if (data.type === "FRIEND_DECLINED") {
                setNotifications((prev) => [
                    createNotification('FRIEND_DECLINED', `${data.from} declined your friend request`, data.from),
                    ...prev
                ]);
            }
            
            if (data.type === "FRIEND_REMOVED") {
                setFriends((prev) => prev.filter(friend => friend !== data.from));
            }
            
            if (data.type === "USER_ONLINE") {
                setOnlineUsers((prev) => {
                    if (!prev.includes(data.username)) {
                        return [...prev, data.username];
                    }
                    return prev;
                });
            }
            
            if (data.type === "USER_OFFLINE") {
                setOnlineUsers((prev) => prev.filter(name => name !== data.username));
            }

            if (data.type === "ONLINE_FRIENDS") {
                setOnlineUsers(data.friends); 
            }

            if (data.type === "INVITE") {
                const newInvite: Invite = {
                    message: data.message,
                    gameId: data.gameId
                };
                setInvites((prev) => [...prev, newInvite]);
            }

            if (data.type === "GAME_RESULT") {
                const place = data.place;
                const score = data.score;
                const totalPlayers = data.totalPlayers;
                
                setNotifications((prev) => [
                    createNotification(
                        'GAME_RESULT',
                        `You placed ${place}${getOrdinalSuffix(place)} with ${score} points!`,
                        undefined,
                        { place, score, totalPlayers }
                    ),
                    ...prev
                ]);
            }

            window.dispatchEvent(new CustomEvent('ws-message', { detail: data }));
        };
        
        socket.onclose = () => {
            console.log("WebSocket connection closed from Header");
        };
    
        return () => {
            
        };
    }, [playerID]);

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
            // Remove the friend request notification
            setNotifications(prev => prev.filter(n => !(n.type === 'FRIEND_REQUEST' && n.from === username)));
        }
    };

    const handleDismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    const handleLogout = () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: "logout",
                username: playerID
            }));
            socketRef.current.close();
            socketRef.current = null;
        }
        
        logout();
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
                                <NotificationDropdown
                                    notifications={notifications}
                                    friendRequests={friendRequests}
                                    onAcceptRequest={(username) => handleRequestSelection(username, true)}
                                    onDeclineRequest={(username) => handleRequestSelection(username, false)}
                                    onDismiss={handleDismissNotification}
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