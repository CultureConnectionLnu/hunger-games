import { service } from "./service/references";

export class WebSocketClientConnection {
  constructor() {
    service.game.createNewGame(["player1", "player2"], async (outcome) => {
      console.log(outcome);
    });
  }
}
