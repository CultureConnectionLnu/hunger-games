import type { BaseGame } from "../base-game";
import type { BasePlayer } from "../base-player";
import type { TimerEvent } from "../timer";
import type { GameTimerHandler } from "./timer";

type Input = Readonly<{
  timerHandler: GameTimerHandler<{
    "disconnect-timer": {
      data: TimerEvent;
      event: "disconnect-timer";
    };
  }>;
  players: BasePlayer[];
  emit: BaseGame["emitEvent"];
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: (winner: string) => void;
  cancelGame: () => void;
}>;

export class GameConnectionHandler {
  private readonly disconnectedPlayers = new Set<string>();

  get disconnectedTimerRunning() {
    return this.input.timerHandler.getTimer("disconnect-timer") !== undefined;
  }

  constructor(private readonly input: Input) {
    this.input.players.forEach((player) => {
      this.handleConnectDisconnect(player);
    });
  }

  private timeoutEvent = () => {
    if (this.disconnectedPlayers.size === 2) {
      this.input.cancelGame();
      return;
    }

    const winner = this.input.players.find(
      (x) => !this.disconnectedPlayers.has(x.id),
    )!.id;
    this.input.endGame(winner);
  };

  private handleConnectDisconnect(player: BasePlayer) {
    player.on("disconnect", ({ id }) => {
      this.disconnectedPlayers.add(id);
      this.input.emit({
        event: "game-halted",
        data: {
          disconnected: [...this.disconnectedPlayers],
        },
      });

      if (this.disconnectedTimerRunning) return;

      this.input.timerHandler.startTimer("disconnect-timer");
      this.input.timerHandler
        .getTimer("disconnect-timer")!
        .once("timeout", this.timeoutEvent);
      this.input.pauseGame();
    });

    player.on("reconnect", ({ id }) => {
      this.disconnectedPlayers.delete(id);
      if (this.disconnectedPlayers.size !== 0) {
        this.input.emit({
          event: "game-halted",
          data: {
            disconnected: [...this.disconnectedPlayers],
          },
        });
        return;
      }

      this.input.emit({
        event: "game-resume",
        data: undefined,
      });

      this.input.timerHandler
        .getTimer("disconnect-timer")
        ?.removeListener("timeout", this.timeoutEvent);
      this.input.timerHandler.cancelTimer("disconnect-timer");
      this.input.resumeGame();
    });
  }
}
