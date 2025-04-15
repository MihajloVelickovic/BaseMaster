import React, { useState } from "react";
import "../styles/Sidebar.css";
import { FaSignOutAlt, FaUser, FaUserFriends } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  function handleLogout() {
    toggleSidebar();
    localStorage.removeItem("playerID");
    navigate("/LoginSignup", { state: { playerIdTransfered: ""} });
  }

  const toggleSidebar = () => setIsOpen(!isOpen);

  const renderSidebar = () => {
    //perfect place to have neo4j
    return (
    <>
      <div className={`sidebar-container ${isOpen ? "open" : ""}`}>
        <button className="close-btn" onClick={toggleSidebar}>
          ✖
        </button>
        <div className="sidebar-content">
          <button className="sidebar-item"><FaUser />  Profile</button>
          <button className="sidebar-item"><FaUserFriends/>  Friend List</button>
          <button className="sidebar-item logout" onClick={handleLogout}><FaSignOutAlt/>  Logout</button>
        </div>
      </div>
    </>);
  }
  //This sidebar is very well structred in terms of code itself
  //It also looks awesome
  //But you know what is certainly is not
  //Functional, we unfortunately do not have profile storing since neo4j is missing
  return (
    <>
      {/* Overlay outside of the sidebar */}
      {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      {/* Header with menu button */}
      <div className="header">
        <button className="menu-button" onClick={toggleSidebar}>
          ☰
        </button>
      </div>

      {/* Render Sidebar */}
      {renderSidebar()}
    </>
  ); // if only you could know what we really are, people who actualy do the work
     //they said that they would do a month ago, maybe longer I stopped counting weeks
}

export default Sidebar;
