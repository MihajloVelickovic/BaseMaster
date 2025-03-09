import { NavLink, useNavigate } from "react-router-dom";
import "../styles/Home.css"
import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";   //ovde za sad ne treba
import {GameModes, Difficulties} from "../shared_modules/shared_enums"

const roundCount = 15;
const maxValue = 255;
const gameID = "gameID";

function Home() {
  const [toBase, setToBase] = useState(2);
  const [playerNum, setPlayerNum] = useState(1);
  const [gameMode, setGameMode] = useState(GameModes.CLASSIC.toString());
  const [difficulty, setDifficulty] = useState(Difficulties.LAYMAN.toString());
  const [gameId, setGameId] = useState(null);


  //           playerCount,
  //           fromBase,
  //           toBase,
  //           roundCount,
  //           difficulty

  const navigate = useNavigate();
  const bases = Array.from({ length: 31}, (_, i) => i+2);
  const players = Array.from({length: 4}, (_, i) => i+1);
  // const gameModes = ["Classic", "Reverse", "Chaos", "Arithmetic classic", "Arithmetic chaos"];  
  const gameModes:string[] = Object.values(GameModes);
  const difficulties:string[] = Object.values(Difficulties);
  
  useEffect(() => {
    if (gameId) {
      navigate("/Game", { state: { toBasee:toBase, playerNum, gameMode, difficulty, gameId } });
    }
  }, [gameId]);  // This effect runs when `gameId` is updated

  const createGame = async () => {
    try {
        const toSend = {
          gamemode: gameMode,
          playerCount: playerNum,
          roundCount: roundCount,
          difficulty: difficulty
        };
        var response = await axiosInstance.post('/game/createGame', toSend);
        console.log("response za createGame je: ", response);
        const gId = response.data[`${gameID}`];        //check the name.. if changed
        console.log("gameId je: ", gId);
        setGameId(gId);

    } catch (error:any) {
        console.error('Error creating game:', error.response ? error.response.data : error.message);
    }
  };
  
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

      
      {Chooser(bases, toBase, setToBase, "Base ", "Choose Base:")}
      {Chooser(players, playerNum, setPlayerNum, "Players: ", "Choose number of players")}
      {Chooser(gameModes, gameMode, setGameMode, "", "Choose Game Mode:")}
      {Chooser(difficulties, difficulty, setDifficulty, "", "Choose difficulty:")}

      {/* <NavLink to="/Game" state={{ base, playerNum, gameMode, gameId }} onClick={createGame}> */}
      <button className="btn btn-success game-button" style={{marginTop:"15px"}} onClick={createGame}>
        Start game buddy!
      </button>
      {/* </NavLink> */}
    </div>
  );
}

export default Home;
