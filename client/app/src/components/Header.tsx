import { Link, NavLink, useLocation } from "react-router-dom";
import "../styles/Header.css"
import Sidebar from "./Sidebar";
import { FaBell, FaCheck, FaTimes } from "react-icons/fa";
import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";

function Header() {
    const [playerID, setPlayerID] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [friendRequests, setFriendRequests] = useState<string[]>([]);
    const [friends, setFriends] = useState<string[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    
    const location = useLocation();
    //const playerIdFromState = location.state?.playerIdTransfered;

    useEffect(() => {
        const fromState = location.state?.playerIdTransfered;
        if (fromState) {
            setPlayerID(fromState);
        }
      }, [location]); 

      useEffect(() => {
        if (!playerID) return;
    
        const socket = new WebSocket(`ws://localhost:1738?playerID=${playerID}`);
    
        socket.onopen = () => {
            console.log("WebSocket connection opened from LoginSignup");

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
            }
            if (data.type === "FRIEND_REMOVED") {
                setFriends((prev) => prev.filter(friend => friend !== data.from));
            }
            if (data.type === "USER_ONLINE") {
                console.log(`${data.username} is now online!`);
            }
            if (data.type === "USER_OFFLINE") {
                console.log(`${data.username} is now offline.`);
            }
        };
    
        socket.onclose = () => {
            console.log("WebSocket connection closed from Header");
        };
    
        return () => {
            socket.close();
        };
    }, [playerID]);

    const handleNotificationBtnClick = async () => {
        setIsOpen((prev) => !prev);
        console.log(playerID);
        if (!isOpen) setUnreadCount(0);
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
                setFriendRequests((prev) => prev.filter((req) => req !== username));
            }
            
            setIsOpen((prev) => !prev);
            
        }
        catch(err:any) {
            console.log(err.message);
        }
        
    }

    const renderNotifications = () => (
        <div className={`notification-dropdown ${isOpen ? "open" : ""}`}>
            {friendRequests.length === 0 ? (
                <span>No new requests</span>
            ) : (
                friendRequests.map((username, index) => (
                    <div className="notificationItem" key={index}>
                        <span>{username}</span>
                        <button onClick={() => handleRequestSelection(username, true)}><FaCheck /></button>
                        <button onClick={() => handleRequestSelection(username, false)}><FaTimes /></button>
                    </div>
                ))
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
</div>
        
 );
}

export default Header