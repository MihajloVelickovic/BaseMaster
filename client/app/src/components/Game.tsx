import { useState, useEffect } from "react";
import "../styles/Game.css";
import { useLocation } from "react-router-dom";


function clcBtnCount(base:bigint, maxValue:bigint) {
  var count = 0, currVal=maxValue;
  while(currVal > 0) {
    ++count;
    currVal = currVal / base;
  }
  return count;
}

function Game() {

  const location = useLocation();
  const { base = 2, playerNum = 1, gameMode = "Classic" } = location.state || {};

  console.log("base: "+base+" playerNum: "+playerNum+" gameMode: "+gameMode);

  const maxVal:bigint = BigInt(255);
  const numOfButtons = clcBtnCount(BigInt(base), maxVal);
  const [arrayOfValues, setArrayOfValues] = useState(Array.from({length: numOfButtons}, (_, i) => 0));
  const btnArrayLabels = Array.from({ length: numOfButtons}, (_, i) => Math.pow(Number(base), numOfButtons - 1 - i));

  function handleButtonClick(key: number) {
    console.log("buttons clicked");
    // if (!arrayOfValues[key]) {
    //   console.log("I guess It doesn't exist..");
    //   return;
    // }

    const newArray = [...arrayOfValues];
    newArray[key] = newArray[key] + 1 >= base ? 0 : newArray[key] + 1;
    console.log(newArray);
    setArrayOfValues(newArray);
  }

  function clearButtonHandler() {
    const newArray = Array.from({length: numOfButtons}, (_, i) => 0)
    setArrayOfValues(newArray);
  }

  function confirmButtonHandler() {
    alert("Idk bro... Maybe it's right, maybe it's not.. That's like moral.. what is good, what is bad? Who knows?!");
  }

  function generateBaseButtons(btnCount: number) {
    const buttonArray = btnArrayLabels.map( (element, ind) => {
      return (
        <div className="ButtonAndLabel">
          <label>
            {element}
          </label>  
          <button className="BaseButton" onClick={() => handleButtonClick(ind)}>
            {arrayOfValues[ind]}
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
    <div className="Game">
      <div>
        <label>I guess the target number should be here </label>
        {generateBaseButtons(numOfButtons)}
      </div>
      <button className= "ClearButton" onClick={clearButtonHandler}>
        Clear
      </button>
      <button className="ConfirmButton" onClick={confirmButtonHandler}>
        Confirm
      </button>
    </div>
  );
} 

export default Game;
