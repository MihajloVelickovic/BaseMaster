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
    
    const location = useLocation();
    //const playerIdFromState = location.state?.playerIdTransfered;

    useEffect(() => {
        const fromState = location.state?.playerIdTransfered;
        if (fromState) {
            setPlayerID(fromState);
        }
      }, [location]); 

    const handleNotificationBtnClick = async () => {
        setIsOpen((prev) => !prev);
        console.log(playerID);
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
            <FaBell onClick={handleNotificationBtnClick} className="bell-icon"/>
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