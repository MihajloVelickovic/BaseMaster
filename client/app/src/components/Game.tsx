import { useState, useEffect } from "react";
import "../styles/Game.css";
import { useLocation } from "react-router-dom";

const maxVal:bigint = BigInt(255);
var numToFind = getRandomNumber(1, Number(maxVal));
var buttonBase = 10;
const maxBase = 32;
var randomBase1 = getRandomNumber(2, 32);     //this may be a temporary fix
var randomBase2 = getRandomNumber(2,32);

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
  var { base = 2, playerNum = 1, gameMode = "Classic" } = location.state || {};

  console.log("base: "+base+" playerNum: "+playerNum+" gameMode: "+gameMode);

  switch (gameMode) {
    case "Classic":
      buttonBase = base;
      break;
    case "Reverse":
      buttonBase = 10;
      break;
    case "Chaos":
      buttonBase = randomBase1;
      base = randomBase2;
      break;
    default:
      buttonBase = base;
  }
  const numOfButtons = clcBtnCount(BigInt(buttonBase), maxVal);
  const [arrayOfValues, setArrayOfValues] = useState(Array.from({length: numOfButtons}, (_, i) => 0));
  const btnArrayLabels = Array.from({ length: numOfButtons}, (_, i) => Math.pow(Number(buttonBase), numOfButtons - 1 - i));

  function handleButtonClick(key: number) {
    console.log("buttons clicked");
    // if (!arrayOfValues[key]) {
    //   console.log("I guess It doesn't exist..");
    //   return;
    // }

    const newArray = [...arrayOfValues];
    newArray[key] = newArray[key] + 1 >= buttonBase ? 0 : newArray[key] + 1;
    console.log(newArray);
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

  function confirmButtonHandler() {
    //alert("Idk bro... Maybe it's right, maybe it's not.. That's like moral.. what is good, what is bad? Who knows?!");
    const result = arrayOfValues.map((val, index) => val * btnArrayLabels[index])
                                .reduce((sum, val) => sum + val, 0);
    if (result==numToFind){
      alert("You got the right answer!");
    }else
      alert("Better luck next time");

    numToFind = getRandomNumber(1, Number(maxVal));
    if (gameMode == "Chaos"){
      base = getRandomNumber(2, maxBase);
      buttonBase = getRandomNumber(2, maxBase);
      randomBase1 = base;         //this is  temporary fix...
      randomBase2 = buttonBase;
    }
    clearButtonHandler();
  }

  function numToBase(num:number, base:number) {
    if (base < 2 || base > 36) {
      throw new Error("Base must be between 2 and 36");
    }
    return num.toString(base).toUpperCase();
  }

  function generateTargetNumLabel(num: number, mode: string) {
    var text;
    switch (mode){
      case "Classic":
        text = <label className="NumToFindLabel">
                ({num})<label className="smallNumToFindLabel">10</label> = (?)<label className="smallNumToFindLabel">{base}</label> 
               </label>
        break;
      case "Reverse":
        text = <label className="NumToFindLabel">
                ({numToBase(num, base)})<label className="smallNumToFindLabel">{base}</label> = (?)<label className="smallNumToFindLabel">10</label> 
               </label>
        break;
      case "Chaos":
        text = <label className="NumToFindLabel">
                ({numToBase(num, base)})<label className="smallNumToFindLabel">{base}</label> = (?)<label className="smallNumToFindLabel">{buttonBase}</label> 
              </label>
        break;
      default:
        text = <label className="NumToFindLabel">
                ({num})<label className="smallNumToFindLabel">10</label> = (?)<label className="smallNumToFindLabel">{base}</label> 
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
    <div className="Game">
      <div>
        {generateTargetNumLabel(numToFind, gameMode)}
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
