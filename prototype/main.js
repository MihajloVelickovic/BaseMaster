document.addEventListener("DOMContentLoaded", function () {
    const baseSelect = document.querySelector("#baseSelect");
    const playerSelect = document.querySelector("#playerSelect");
    const confirmButton = document.querySelector("#confirmButton");
    const helpChbx = document.querySelector("#help");
    const gamemode = document.querySelector("#gamemodeSelect");

    let toBase = "";
    let selectedPlayers = "";
    let fromBase = "10";
    if (!baseSelect || !playerSelect) {
        console.error("One or more dropdown elements not found");
        return;
    }
    
    const baseMax = 32;
    const playerCountMax = 4;
    const maxVal = 255;
    const minVal = 0;
    const minBase = 2;

    for (let base = 2; base <= baseMax; base++) {
        const option = document.createElement("option");
        option.value = base;
        option.textContent = `Base ${base}`;
        baseSelect.appendChild(option);
    }

    for (let players = 1; players <= playerCountMax; players++) {
        const option = document.createElement("option");
        option.value = players;
        option.textContent = `${players} Player${players > 1 ? 's' : ''}`;
        playerSelect.appendChild(option);
    }

    console.log("Base and Player selections successfully populated.");

    confirmButton.addEventListener("click", function () {
        // Select the container
        const container = document.querySelector("#gameOptions");

        // Hide all child elements inside the container (except the header)
        while (container.firstChild) {
            if (container.firstChild !== document.querySelector("header")) {
                container.firstChild.remove();
            } else {
                // Once the header is reached, stop removing
                break;
            }
        }
        
        toBase = baseSelect.value;
        selectedPlayers = playerSelect.value;
        

        console.log("All elements removed except the header.");

        container.classList.add("main-div")

        if(gamemode.value.toLowerCase() === "reverse") {
            [fromBase, toBase] = [toBase, fromBase];
        }
        else if (gamemode.value.toLowerCase() === "chaos") {
            fromBase = genRandomInt(minBase, baseMax);
            toBase = genRandomInt(minBase, baseMax);
        }
        buttonCount = Math.floor(logBase(maxVal, toBase)) + 1;

        const label = document.createElement("label");
        label.setAttribute("for", "newInput");  
        label.textContent = `BASE ${toBase}`; 
        container.appendChild(label);   

        // Create the button container
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("button-container");
        buttonContainer.id = "buttonContainer";
        const threshold = parseInt(toBase) - 1
        
        const randomInt = genRandomInt(minVal, maxVal);

        const randomNum = document.createElement("label");
        label.setAttribute("for", "newInput");  
        label.textContent = genRandomNumLblText(randomInt, fromBase,toBase);
        label.id = "randomNum";
        label.classList.add("random-num-label") 
        container.appendChild(label);  

  
        // Dynamically create buttons

        fillButtonContainer(buttonCount, buttonContainer, helpChbx.checked, handleButtonClick, toBase);

        
        container.appendChild(buttonContainer);

        const cleatButton = document.createElement("button");
        cleatButton.textContent = "CLEAR";
        cleatButton.classList.add("clear-button");
        cleatButton.addEventListener("click", clearButtonValues);
        container.appendChild(cleatButton);


        const confirmButton = document.createElement("button");
        confirmButton.textContent = "Confirm";
        confirmButton.classList.add("check-button");
        confirmButton.addEventListener("click", checkInputPressedHandle);
        container.appendChild(confirmButton);
    });

    function checkInputPressedHandle() {
        checkInput(toBase);
            const buttonContainer = document.querySelector("#buttonContainer");
            if(gamemode === "chaos") {
                while (buttonContainer.firstChild) {
                    buttonContainer.removeChild(buttonContainer.firstChild);
                }
                buttonCount = Math.floor(logBase(maxVal, toBase)) + 1;
                fillButtonContainer(buttonCount, buttonContainer, helpChbx.checked, handleButtonClick, toBase);
            }
    }

    function clearButtonValues() {
        const buttonContainer = document.querySelector("#buttonContainer");
        Array.from(buttonContainer.children).forEach(b => {
            const button = b.querySelector("button"); // Find the button inside the div
            if (button) {
                button.textContent = "0"; // Set the button's text
            }
        });
    }

    function handleButtonClick(event) {
        const button = event.target;  // Get the button that was clicked
        let currentValue = parseInt(button.textContent, 36);
        const threshold = parseInt(toBase) - 1;
        // Increment the value until it reaches the threshold
        if (currentValue < threshold) {
            currentValue++;
            button.textContent = convertToBase(currentValue, toBase);
        }
        else {
            currentValue = 0;
            button.textContent = `0`;
        }
    } 

    function convertToBase(num, base) {
        if (base > 10) {
            return num.toString(base).toUpperCase(); // Convert to base and make letters uppercase
        }
        return num.toString(); // For bases <= 10, just return the number as a string
    }


    function genRandomNumLblText(randomInt, fromBase, toBase) {
        return `( ${randomInt.toString(fromBase).toUpperCase()} )
                               ${toSubstript(parseInt(fromBase))}
                               → ( ? ) ${toSubstript(parseInt(toBase))} `;
    }

    function checkInput(base) {
        const label = document.getElementById("randomNum"); // Get the label displaying the random number
        let targetNumber = label.textContent; // The number we need to check 
        const buttons = document.querySelectorAll(".dynamic-button"); // Get all the buttons
        let combinedValue = "";
        
        let firstOne = false;

        console.log(`Number ${targetNumber}, base: ${base}`)

        targetNumber =
         parseInt(targetNumber.split(" ")[1], fromBase).toString(base)
                                                       .toUpperCase();

        //console.log(`Number after${targetNumber}`)

        buttons.forEach(b => {
            if(firstOne)
                combinedValue += b.textContent;
            else if(!firstOne && b.textContent !== "0") {
                combinedValue += b.textContent;
                firstOne = true;
            }

        });
        
        combinedValue = combinedValue === "" ? "0":combinedValue;

        combinedValue.toUpperCase();

        console.log(`Combined value: ${combinedValue}`);
        console.log(`Target num: ${targetNumber}`);

        if(combinedValue === targetNumber)
            alert("Correct!");
        else
            alert("Incorrect! Going to next num....");

        if (gamemode.value.toLowerCase() === "chaos") {
            fromBase = genRandomInt(minBase, baseMax);
            toBase = genRandomInt(minBase, baseMax);
        }
        
        const randomInt = genRandomInt(minVal, maxVal);
        label.textContent = genRandomNumLblText(randomInt, fromBase,toBase);
        
        
    }

    function genRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    function logBase(x, base) {
        return Math.log(x) / Math.log(base);
    }

    function toSubstript(num) {
        const base = 0x2080;

        return num.toString()
                  .split("")
                  .map((digit) => String.fromCharCode(parseInt(digit,10) + base))
                  .join("");
    }

    function fillButtonContainer(buttonCount, buttonContainer, addHelpLabels, handleButtonClick, toBase) {
        for (let i = 1; i <= buttonCount; i++) {
            const buttonWrapper = document.createElement("div");
            buttonWrapper.classList.add("button-wrapper")

            if(addHelpLabels) {
                
                const sBase = parseInt(toBase);
                console.log(`Selected base: ${sBase}`);
                console.log(`Power: ${buttonCount - i}`);
                const helpLabel = document.createElement("label");
                helpLabel.setAttribute("for", "newInput");
                helpLabel.classList.add("help-label")  
                helpLabel.textContent = 
                `${Math.pow(sBase, buttonCount - i)}`; 
                buttonWrapper.appendChild(helpLabel);
            }

            const button = document.createElement("button");
            button.classList.add("dynamic-button");
            button.textContent = `0`; 
            button.addEventListener("click", handleButtonClick);
            buttonWrapper.appendChild(button);
            buttonContainer.appendChild(buttonWrapper);
        }
    }
});
