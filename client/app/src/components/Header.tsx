import { Link, NavLink } from "react-router-dom";
import "../styles/Header.css"

function Header() {
 return (
    <div className="Header">
        <label>Ovo je header label</label>
        <label>Ovo je drugi header label!</label>
        <Link to="/">
            <button className="header-link-button">
                Home
            </button>
        </Link>
        <Link to="/Game">
            <button className="header-link-button">
                Game
            </button>
        </Link>
    
    </div>
 );
}

export default Header