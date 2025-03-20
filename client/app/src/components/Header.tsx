import { Link, NavLink } from "react-router-dom";
import "../styles/Header.css"
import Sidebar from "./Sidebar";

function Header() {
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

    </div>
        
 );
}

export default Header