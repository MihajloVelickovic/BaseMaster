import { useState, useEffect } from "react";
import "../styles/Game.css";


function clcBtnCount(base:bigint, maxValue:bigint) {
  var count = 0, currVal=maxValue;
  while(currVal > 0) {
    ++count;
    currVal = currVal / base;
  }
  return count;
}

function Game() {
  const maxVal:bigint = BigInt(255);
  const base:bigint = BigInt(2);
  const baseNum = base;
  const [arrayOfValues, setArrayOfValues] = useState(Array.from({length: clcBtnCount(base, maxVal)}, (_, i) => 0));
  const btnArrayLabels = Array.from({ length: clcBtnCount(base, maxVal)}, (_, i) => Math.pow(Number(base), i));

  function btnClicked(key: number) {
    if (!arrayOfValues[key])
      return;
    arrayOfValues[key] = arrayOfValues[key]+1 >= base ? 0:arrayOfValues[key]+1;
    setArrayOfValues(arrayOfValues);
  }

  function generateBaseButtons(btnCount: number) {
    const buttonArray = btnArrayLabels.map( (element, ind) => {
      return (
        <button>
          {arrayOfValues[ind]}
        </button>
      );

    })
  }

  function handleClick() {
  }

  return (
    <div className="Game">
      <div>

      </div>
    </div>
  );
}

export default Game;
