import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";


function FriendList() {
    const location = useLocation();
    const navigate = useNavigate();
    const [username, setUsername] = useState(location.state?.playerIdTransfered);
    const [friends, setFriends] = useState<string[]>([]);


    useEffect(() => {


        const fetchFriends = async () => {
            const response = await axiosInstance.post('/user/getFriends', {username:username})
            
            console.log(response);
        };
    
        if (username) {
            console.log("Pre fetcha")
            fetchFriends();

        }
    }, [username]);

    return (
            <>
            <p></p>
             
        </>
    )
}

export default FriendList;