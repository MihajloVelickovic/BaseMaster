import { useState, useEffect } from "react";
import "../styles/Game.css";
import { useLocation } from "react-router-dom";
import { GameModes, Difficulties, DifficultyValues } from "../shared_modules/shared_enums";
import axiosInstance from "../utils/axiosInstance";

var maxVal:bigint = BigInt(255);
var numToFind = getRandomNumber(1, Number(maxVal));   //this appears to be unneeded
const maxBase = 32;


function clcBtnCount(base:bigint, maxValue:bigint) {
  var count = 0, currVal=maxValue;
  while(currVal > 0) {
    ++count;
    currVal = currVal / base;
  }
  return count;
}

function getRandomNumber(min:number, max:number) {
  min = Math.floor(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function Game() {
  const location = useLocation();
  const [currRound, setCurrRound] = useState(0);
  const [currNum, setCurrNum] = useState(100);
  const [toBase, setToBase] = useState(2);
  const [fromBase, setFromBase] = useState(10);
  const [scoreboard, setScoreboard] = useState<{ value: string, score: number }[]>([]);

  var { toBasee = 2, playerNum = 1, gameMode = GameModes.CLASSIC.toString(), difficulty = Difficulties.LAYMAN.toString(), gameId = "", playerID = "" } = location.state || {};
  console.log("toBasee je: ", toBasee);
  useEffect( () => {
    const ws = new WebSocket("ws://localhost:1738");
    switch (gameMode) {         //will go back to this later...
      case "Classic":
        break;
      case "Reverse":
        setFromBase(toBase);
        setToBase(10);
        break;
      case "Chaos":
        break;
      default:
    }
    switch (difficulty) {
      case Difficulties.LAYMAN.toString(): maxVal = BigInt(DifficultyValues.LAYMAN);
        break;
      case Difficulties.CHILL_GUY.toString(): maxVal = BigInt(DifficultyValues.CHILL_GUY);
        break;
      case Difficulties.ELFAK_ENJOYER.toString(): maxVal = BigInt(DifficultyValues.ELFAK_ENJOYER);
        break;
      case Difficulties.BASED_MASTER.toString(): maxVal = BigInt(DifficultyValues.BASED_MASTER);
        break;
      default:
        maxVal = BigInt(DifficultyValues.LAYMAN);
        console.log("something went wrong for this to show up");
    }
    

    

    ws.onopen = () => {
      
      ws.send(JSON.stringify({ type: "joinLobby", gameId, playerID }));
  };

  ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
      if (data.type === "scoreUpdate") {
        setScoreboard(data.scores.sort((a: { value: string; score: number }, b: { value: string; score: number }) => b.score - a.score));
    }
  };

  updateGameState("GAME STARTED");
  getNumberFromServer(false);
  return () => ws.close(); // Cleanup WebSocket on unmount
    //clearButtonHandler();
    
  }, [])

  console.log("toBase: "+toBase+" playerNum: "+playerNum+" gameMode: "+gameMode+" difficulty: "+difficulty+ " gameId: "+gameId);
  
  const updateGameState = async (newState: string) => {
    try {
      await axiosInstance.post('/game/setGameState', { gameId, gameState: newState });
      console.log("Game state updated:", newState);
    } catch (error: any) {
      console.error("Error updating game state:", error.response?.data || error.message);
    }
  };

  const getNumberFromServer = async (correct:boolean) => {
    const toSend = {
      gameId:gameId,
      currRound:currRound,
      playerId: playerID,
      correct: correct
    }
    var response = await axiosInstance.post('/game/getCurrNum', toSend);
    const num:number = Number(response.data['currRndNum']);        //check the name.. if changed
    if (gameMode == GameModes.CHAOS.toString()) {
      setToBase(Number(response.data['toBase']));
      setFromBase(Number(response.data['fromBase']));
      let val = clcBtnCount(BigInt(Number(response.data['toBase'])), maxVal);
      console.log(toBase, fromBase, val);
      setNumOfButtons(val);
      setArrayOfValues(Array.from({length: val}, (_, i) => 0));
    }
    //console.log(response.data["scoreboard"])
    console.log(response);
    setCurrRound(currRound+1);
    setCurrNum(num);
    console.log("Current round: ", currRound);  

      return num;

  }


  switch (difficulty) {
    case Difficulties.LAYMAN.toString(): maxVal = BigInt(DifficultyValues.LAYMAN);
      break;
    case Difficulties.CHILL_GUY.toString(): maxVal = BigInt(DifficultyValues.CHILL_GUY);
      break;
    case Difficulties.ELFAK_ENJOYER.toString(): maxVal = BigInt(DifficultyValues.ELFAK_ENJOYER);
      break;
    case Difficulties.BASED_MASTER.toString(): maxVal = BigInt(DifficultyValues.BASED_MASTER);
      break;
    default:
      maxVal = BigInt(DifficultyValues.LAYMAN);
      console.log("something went wrong for this to show up");
  }

  const [numOfButtons, setNumOfButtons] = useState(clcBtnCount(BigInt(toBase), maxVal));
  const [arrayOfValues, setArrayOfValues] = useState(Array.from({length: numOfButtons}, (_, i) => 0));  
  const btnArrayLabels = Array.from({ length: numOfButtons}, (_, i) => Math.pow(Number(toBase), numOfButtons - 1 - i));

  function handleButtonClick(key: number) {
    // if (!arrayOfValues[key]) {
    //   console.log("I guess It doesn't exist..");
    //   return;
    // }

    const newArray = [...arrayOfValues];
    newArray[key] = newArray[key] + 1 < toBase ? newArray[key] + 1: 0;
    setArrayOfValues(newArray);
  }

  function numToLetter(num:number) : string {
    if (num < 10) 
      return num.toString();
    return String.fromCharCode(55 + num);  
  }

  function clearButtonHandler() {
    const newArray = Array.from({length: numOfButtons}, (_, i) => 0)
    setArrayOfValues(newArray);
  }

  const confirmButtonHandler = async () => {
    //alert("Idk bro... Maybe it's right, maybe it's not.. That's like moral.. what is good, what is bad? Who knows?!");
    const result = arrayOfValues.map((val, index) => val * btnArrayLabels[index])
                                .reduce((sum, val) => sum + val, 0);
    if (result==currNum){
      alert("You got the right answer!");
    }else
      alert("Better luck next time");

    await getNumberFromServer(result==currNum);
    
    //clearButtonHandler();
    
  }

  function numtoBase(num:number, tobase:number) {
    if (tobase < 2 || tobase > 36) {
      throw new Error("Base must be between 2 and 36");
    }
    let p = 69;
    return num.toString(tobase).toUpperCase();
  }

  function generateTargetNumLabel(num: number, mode: string) {
    var text;
    switch (mode){
      case "Classic":
        text = <label className="NumToFindLabel">
                ({num})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
               </label>
        break;
      case "Reverse":
        text = <label className="NumToFindLabel">
                ({numtoBase(num, fromBase)})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
               </label>
        break;
      case "Chaos":
        console.log(toBase, fromBase, num, gameMode);
        text = <label className="NumToFindLabel">
                ({numtoBase(num, fromBase)})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
              </label>
        break;
      default:
        text = <label className="NumToFindLabel">
                ({num})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
              </label>
    }

    return (
      text
    );
 
  }

  function generateBaseButtons(btnCount: number) {
    const buttonArray = btnArrayLabels.map( (element, ind) => {
      return (
        <div className="ButtonAndLabel">
          <label>
            {element}
          </label>  
          <button className="BaseButton" onClick={() => handleButtonClick(ind)}>
            {numToLetter(arrayOfValues[ind])}
          </button>
        </div>
      );
    });
    return (
      <div className="AllButtonsAndLables">
        {buttonArray}
      </div>
    );
  }

  return (
    <div className="GameScreen">
    <div className="Game">
      
      {generateTargetNumLabel(currNum, gameMode)}
      {generateBaseButtons(numOfButtons)}
      
      <button className= "ClearButton" onClick={clearButtonHandler}>
        Clear
      </button>
      <button className="ConfirmButton" onClick={confirmButtonHandler}>
        Confirm
      </button>
    
    </div>    
        <div className="Scoreboard">
        <h2>Scoreboard</h2>
        <ul>
          {scoreboard.map((player, index) => (
            <li key={index}>{player.value}: {player.score} pts</li>
          ))}
        </ul>
        </div>
    </div>
  );
} 

export default Game;