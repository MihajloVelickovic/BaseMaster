import { Link, NavLink } from "react-router-dom";
import "../styles/Header.css"

function Header() {
 return (
    <div className="Header">
        <label>Temporary links: </label>
        <Link to="/">
            <button className="btn btn-primary header-link-button">
                Home
            </button>
        </Link>
        <Link to="/Game">
            <button className="btn btn-primary header-link-button">
                Game
            </button>
        </Link>
    
    </div>
 );
}

export default Header