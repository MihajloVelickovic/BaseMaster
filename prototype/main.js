document.addEventListener("DOMContentLoaded", function () {
    const baseSelect = document.querySelector("#baseSelect");
    const playerSelect = document.querySelector("#playerSelect");
    const confirmButton = document.querySelector("#confirmButton");

    let selectedBase = "";
    let selectedPlayers = "";

    if (!baseSelect || !playerSelect) {
        console.error("One or more dropdown elements not found");
        return;
    }
    
    const baseMax = 32;
    const playerCountMax = 4;
    const maxVal = 32;

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
        
        selectedBase = baseSelect.value;
        selectedPlayers = playerSelect.value;

        console.log("All elements removed except the header.");

        container.classList.add("main-div")

        const label = document.createElement("label");
        label.setAttribute("for", "newInput");  
        label.textContent = `BASE ${selectedBase}`; 
        container.appendChild(label);  

        // Create the button container
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("button-container");

        const threshold = selectedBase - 1
        
        const randomInt = genRandomInt(maxVal);

        const randomNum = document.createElement("label");
        label.setAttribute("for", "newInput");  
        label.textContent = `${randomInt}`;
        label.id = "randomNum";
        label.classList.add("random-num-label") 
        container.appendChild(label);  


        function handleButtonClick(event) {
            const button = event.target;  // Get the button that was clicked
            let currentValue = parseInt(button.textContent, 36);

            // Increment the value until it reaches the threshold
            if (currentValue < threshold) {
                currentValue++;
                button.textContent = convertToBase(currentValue, selectedBase);
            }
            else {
                currentValue = 0;
                button.textContent = `0`;
            }

        }

        buttonCount = logBase(maxVal, selectedBase) + 1;

        // Dynamically create 4 buttons
        for (let i = 1; i <= buttonCount; i++) {
            const button = document.createElement("button");
            button.classList.add("dynamic-button");
            button.textContent = `0`; 
            button.addEventListener("click", handleButtonClick);
            buttonContainer.appendChild(button);
        }
        
        container.appendChild(buttonContainer);

        const cleatButton = document.createElement("button");
        cleatButton.textContent = "CLEAR";
        cleatButton.classList.add("clear-button");
        cleatButton.addEventListener("click", () => {
            Array.from(buttonContainer.children).forEach(b => {
                b.textContent = "0"
            });
        });
        container.appendChild(cleatButton);


        const confirmButton = document.createElement("button");
        confirmButton.textContent = "Confirm";
        confirmButton.classList.add("check-button");
        confirmButton.addEventListener("click", () => {
            checkInput(selectedBase);
        });
        container.appendChild(confirmButton);
    });

    function convertToBase(num, base) {
        if (base > 10) {
            return num.toString(base).toUpperCase(); // Convert to base and make letters uppercase
        }
        return num.toString(); // For bases <= 10, just return the number as a string
    }

    function checkInput(base) {
        const label = document.getElementById("randomNum"); // Get the label displaying the random number
        let targetNumber = label.textContent; // The number we need to check
        const buttons = document.querySelectorAll(".dynamic-button"); // Get all the buttons
        let combinedValue = "";
        
        let firstOne = false;

        //console.log(`Number ${typeof(targetNumber)}, base: ${base}`)

        targetNumber = parseInt(targetNumber, 10).toString(base).toUpperCase();

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

        //console.log(`Combined value: ${combinedValue}`)

        if(combinedValue === targetNumber)
            alert("Correct!");
        else
            alert("Incorrect! Going to next num....");

        label.textContent = `${genRandomInt(maxVal)}`
        
        
    }

    function genRandomInt(max) {
        return randomInt = Math.floor(Math.random() * max);
    }

    function logBase(x, base) {
        return Math.log(x) / Math.log(base);
    }

    
});
