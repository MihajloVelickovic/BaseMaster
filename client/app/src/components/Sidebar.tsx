import React, { useState } from "react";
import "../styles/Sidebar.css";
import { FaSignOutAlt, FaUser, FaUserFriends } from "react-icons/fa";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const renderSidebar = () => {
    return (
    <>
      <div className={`sidebar-container ${isOpen ? "open" : ""}`}>
        <button className="close-btn" onClick={toggleSidebar}>
          ✖
        </button>
        <div className="sidebar-content">
          <button className="sidebar-item"><FaUser />  Profile</button>
          <button className="sidebar-item"><FaUserFriends/>  Friend List</button>
          <button className="sidebar-item logout"><FaSignOutAlt/>  Logout</button>
        </div>
      </div>
    </>);
  }
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
  );
}

export default Sidebar;
