import { NavLink } from "react-router-dom";
import "../styles/Home.css"
import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useState } from "react";
import axiosInstance from "../utils/axiosInstance";


function Home() {
  const [base, setBase] = useState(2);
  const [playerNum, setPlayerNum] = useState(1);
  const [gameMode, setGameMode] = useState("Classic");

  const bases = Array.from({ length: 31}, (_, i) => i+2);
  const players = Array.from({length: 4}, (_, i) => i+1);
  const gameModes = ["Classic", "Reverse", "Chaos", "Arithmetic classic", "Arithmetic chaos"];  
  
  function Chooser<T extends string | number>(choosingArray: T[], state: T, setState: (value: T) => void, text: string, labelTxt: string) {
    function onSelection(value: T) {
      setState(value);   
    }
    const basesButtons = choosingArray.map((val, ind) => {
      return (
        <li className="choosingFont">
          <button className="dropdown-item" onClick={() => onSelection(val)}>
            {text} {val}
          </button>
        </li>
      )
    })
    return (
    <div className="choosingDiv">
    
      <label className="smallFont">{labelTxt}</label  >
      <div className="dropdown choosingBtn">
        <button className="btn btn-secondary dropdown-toggle choosingBtn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          {text}{state}
        </button>
        <ul className="dropdown-menu">
          {basesButtons}
        </ul>
      </div>
    </div>  
    )

  }

  return (
    <div className="HomeContainer">

      <label className="mainFont">Game Options</label>

      
      {Chooser(bases, base, setBase, "Base ", "Choose Base:")}
      {Chooser(players, playerNum, setPlayerNum, "Players: ", "Choose number of players")}
      {Chooser(gameModes, gameMode, setGameMode, "", "Choose Game Mode:")}

      <NavLink to="/Game" state={{ base, playerNum, gameMode }}>
        <button className="btn btn-success game-button" style={{marginTop:"15px"}}>
          Start game buddy!
        </button>
      </NavLink>
    </div>
  );
}

export default Home;
