import { Link, NavLink, useLocation } from "react-router-dom";
import "../styles/Header.css"
import Sidebar from "./Sidebar";
import { FaBell, FaCheck, FaTimes } from "react-icons/fa";
import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { useFriendContext } from "../utils/FriendContext"
import { useLobbyContext } from "../utils/LobbyContext";
import { GiCrossedSwords } from "react-icons/gi";

function Header() {
    type Invite = {
        message: string;
        gameId: string;
      };
    const [playerID, setPlayerID] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { friendRequests,setFriends, setFriendRequests, setOnlineUsers } = useFriendContext();
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<string[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [showInvites, setShowInvites] = useState(false);

    
    const location = useLocation();
    const { joinLobby, setPlayerID: setLobbyPlayerID } = useLobbyContext();
    //const playerIdFromState = location.state?.playerIdTransfered;

    useEffect(() => {
        const fromState = location.state?.playerIdTransfered;
        if (fromState) {
            setPlayerID(fromState);
            setLobbyPlayerID(fromState);
        }
      }, [location]); 

      useEffect(() => {
        if (!playerID) return;
    
        const socket = new WebSocket(`ws://localhost:1738?playerID=${playerID}`);
    
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: "login",
                username: playerID
            }));
        };
    
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received from WebSocket:", data);
        
            if (data.type === "FRIEND_REQUEST") {
                setFriendRequests((prev) => [...prev, data.from]);
                setUnreadCount((count) => count + 1)
            }
            if (data.type === "FRIEND_ACCEPTED") {
                setFriends((prev) => [...prev, data.from]);
                setNotifications((prev) => [
                    ...prev.filter(msg => !msg.includes(`${data.from} `)),  
                    `${data.from} accepted your friend request`
                ]);
                setUnreadCount((count) => count + 1)
            }
            if (data.type === "FRIEND_DECLINED") {
                setNotifications((prev) => [
                    ...prev.filter(msg => !msg.includes(`${data.from} `)),
                    `${data.from} declined your friend request`
                ]);
                setUnreadCount((count) => count + 1);
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

            if(data.type === "INVITE") {
                console.log(data);
                const newInvite: Invite = {
                    message: data.message,
                    gameId: data.gameId
                  };
                  setInvites((prev) => [...prev, newInvite]);
            }
        };
    
        socket.onclose = () => {
            console.log("WebSocket connection closed from Header");
        };
    
        return () => {
            socket.close();
        };
    }, [playerID]);

    const handleInviteIconClick = () => {
        setShowInvites(prev => !prev);
    };

    const removeInvite = (gameId: string) => {
        setInvites(prev => prev.filter(inv => inv.gameId !== gameId));
        setShowInvites(false);
    };

    const handleNotificationBtnClick = async () => {
        setIsOpen((prev) => !prev);
        console.log(playerID);
        if (!isOpen) 
        {
            setUnreadCount(0);
            setNotifications([]);
        }
        try {
            var response = await axiosInstance.post('/user/friendRequests',
                                                     {username:playerID});
            console.log(response.data);
            setFriendRequests(response.data.requests)
        }
        catch(err:any) {
            console.log(err.message);
        }
        
        console.log(isOpen);
    }

    async function handleRequestSelection(username: string, selection:boolean) {
        //const {username, sender, userResponse} = req.body;
        try {
            const response = await axiosInstance.post('/user/handleFriendRequest',
                {username: playerID, sender: username, userResponse: selection});
            
            if (selection === true) {
                setFriends(prev => [...prev, username]); 
                console.log(response);
                console.log("SUCCESFULLY BECAME FRIENDS!!!!!!");
            }
            
        }
        catch (err: any) {
            if (err.response) {
                console.error("Server responded with error:", err.response.status, err.response.data);
            } else {
                console.error("Request error:", err.message);
            }
        }
        finally{
            setFriendRequests((prev) => prev.filter((req) => req !== username));
            setIsOpen(false);
        }
        
    }

    const renderNotifications = () => (
        <div className={`notification-dropdown ${isOpen ? "open" : ""}`}>
            {friendRequests.length === 0 && notifications.length === 0 ? (
                <span>No new notifications</span>
            ) : (
                <>
                    {friendRequests.map((username, index) => (
                        <div className="notificationItem" key={`req-${index}`}>
                            <span>{username}</span>
                            <button onClick={() => handleRequestSelection(username, true)}><FaCheck /></button>
                            <button onClick={() => handleRequestSelection(username, false)}><FaTimes /></button>
                        </div>
                    ))}
                    {notifications.map((message, index) => (
                        <div className="notificationItem" key={`note-${index}`}>
                            <span>{message}</span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
 return (
    <div className="Header">
        <Sidebar/>
         <label>Temporary links: </label>
        <Link to="/">
            <button className="btn btn-primary header-link-button">
                Home
            </button>
        </Link>
        <Link to="/Lobby">
            <button className="btn btn-primary header-link-button">
                Lobby
            </button>
        </Link>
        <Link to="/Game">
            <button className="btn btn-primary header-link-button">
                Game
            </button>
        </Link>
        <Link to="/LoginSignup">
            <button className="btn btn-primary header-link-button">
                LoginSignup
            </button>
        </Link>
        <div className="bell-container">
            <div className="bell-wrapper">
                <FaBell onClick={handleNotificationBtnClick} className="bell-icon" />
                {unreadCount > 0 && (
                    <div className="notification-badge">{unreadCount}</div>
                )}
            </div>
        {isOpen && (
            <div>
                {renderNotifications()}
            </div>
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
        <div>
    </div>
</div>
        
 );
}

export default Header