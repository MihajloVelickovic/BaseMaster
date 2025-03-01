import { NavLink } from "react-router-dom";
import "../styles/Home.css"

function Home() {
  return (
    <div className="Home">
      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header> */}
      <label>Ovo je neki prvi label</label>
      <label>Ovo je neki drugi</label>
      <li><NavLink to="/Game">
        <button className="game-button" style={{marginTop:"15px"}}>
            Udji u game!
        <div className="arrow-wrapper">
            <div className="arrow"></div>
        </div>
        </button>
        </NavLink></li>
    </div>
  );
}

export default Home;
