
export default class GameInfo {
    randomNumbers:number[];
    gameId:string;
    

    constructor(randomNumbers, gameId) {
       this.randomNumbers = randomNumbers;
       this.gameId = gameId;
    }
}