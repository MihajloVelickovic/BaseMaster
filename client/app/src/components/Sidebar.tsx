import React, { useEffect, useState } from "react";
import "../styles/Sidebar.css";
import { FaSignOutAlt, FaUser, FaUserFriends } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";


function Sidebar({ onLogout }: { onLogout: () => void }) {
  const { playerID, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem("playerID") || "");
  const navigate = useNavigate();
  
   function handleLogout() {
    onLogout(); // Call the passed function
    toggleSidebar();
    navigate("/LoginSignup", { state: { playerIdTransfered: null} });
  }

  const toggleSidebar = () => setIsOpen(!isOpen);

   useEffect(() => {
          const fromState = location.state?.playerIdTransfered;
          if (fromState) {
              setUsername(fromState);
          }
    }, [location]); 

  const handleFriendList = () => {
    console.log("sidebar username", username)
    navigate("/FriendList", { state: { playerIdTransfered: username} });
    toggleSidebar();
  }

  const renderSidebar = () => (
    

    //perfect place to have neo4j
    <>
      <div className={`sidebar-container ${isOpen ? "open" : ""}`}>
        <div className="sidebar-content">
          <button className="sidebar-item" onClick={() => {toggleSidebar(); navigate("/Profile")}}><FaUser />  Profile</button>
          <button className="sidebar-item" onClick={handleFriendList}><FaUserFriends/>  Friend List</button>
          <button className="sidebar-item logout" onClick={handleLogout}><FaSignOutAlt/>  Logout</button>
        </div>
      </div>
    </>
  );

  if (!localStorage.getItem("playerID")) return null;

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
    <div className="header">
      {username ? (
        <button className="username-display" onClick={toggleSidebar}>
          {username}
        </button>
      ) : (
        <button className="login-button" onClick={() => window.location.href = '/login'}>
          Login
        </button>
      )}
    </div>
    {username && renderSidebar()}
    </>
  );
}

// <button className="close-btn" onClick={toggleSidebar}>
//   ✖
// </button>

export default Sidebar;
