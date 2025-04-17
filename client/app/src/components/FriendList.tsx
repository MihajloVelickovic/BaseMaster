import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";
import "../styles/FriendList.css";
import { FaUserMinus } from "react-icons/fa";

function FriendList() {
    const location = useLocation();
    const navigate = useNavigate();
    const [username, setUsername] = useState(location.state?.playerIdTransfered);
    const [friends, setFriends] = useState<string[]>([]);
    const [friendToRemove, setFriendToRemove] = useState<string | null>(null);

    useEffect(() => {
        const fetchFriends = async () => {
            const response = await axiosInstance.post('/user/getFriends', {username:username})
            setFriends(response.data.friends);
            console.log(response);
        };
    
        if (username) {
            console.log("Pre fetcha")
            fetchFriends();
        }
    }, [username]);

    const handleRemove = async () => {
        if(!friendToRemove) return;
        console.log(friendToRemove);
        console.log(username);
        try {
          await axiosInstance.post("/user/removeFriend", { username, friend: friendToRemove });
          setFriends(friends.filter(f => f !== friendToRemove));
          setFriendToRemove(null); 
        } catch (error) {
          console.error("Failed to remove friend", error);
        }
    };

   return (
    <div className="friend-list-container">
        <h2>Friend list</h2>
        {friends.length === 0 ? (
            <span>No friends yet :(</span>
        ) : (
            friends.map((friend,index) => (
                <div className="friend-card" key={index}>
                    <span className="friend-name">{friend}</span>
                    <button className="remove-button" onClick={() => setFriendToRemove(friend)}>
                            Remove
                            <FaUserMinus style={{ marginLeft: "9px", marginBottom:"2px" }} />
                    </button>
                </div>
            ))
        )}

        {friendToRemove && (
            <div className="confirmationDialog">
                <p>Are you sure you want to remove <strong>{friendToRemove}</strong> from your friend list?</p>
                <button className="confirm-button" onClick={handleRemove}>Yes, Remove</button>
                <button onClick={() => setFriendToRemove(null)}>Cancel</button>
            </div>
        )}
    </div>
   );
}

export default FriendList;