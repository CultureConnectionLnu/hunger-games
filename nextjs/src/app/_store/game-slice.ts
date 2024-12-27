import { type StateCreator } from "zustand";
import { type ConnectionPlayerView } from "~/server/stores/core/connection-view-slice";
import { type RockPaperScissorsItem } from "~/server/stores/games/rock-paper-scissors-slice";
import { type RockPaperScissorsPlayerView } from "~/server/stores/games/rock-paper-scissors-view-slice";
import { type WsMessageToClient } from "~/server/web-socket-connection";
import { WSClient } from "./ws-client";

// #region types

interface GameSlice {
  game: {
    mutable: {
      room?: ConnectionPlayerView;
      gameSpecific?: GameSpecific;
      gameIsOngoing: boolean;
      connected: boolean;
    };
    joinGame: WsCall;
    pauseGame: WsCall;
    resumeGame: WsCall;
    markReady: WsCall;
    /**
     * This will cleanup the game slice and will prohibit further calls to the WebSocket.
     * Therefore rendering the game slice unusable.
     */
    cleanup: () => void;
  };
}

type WsCallResult =
  | undefined
  | {
      connected: boolean;
      gameIsOngoing: boolean;
    };
type WsCall<Param = never> = (param: Param) => WsCallResult;

type GameSpecificMap = {
  "rock-paper-scissors": {
    actions: {
      chooseItem: WsCall<RockPaperScissorsItem>;
    };
    logic: RockPaperScissorsPlayerView;
  };
};

type GameSpecific = {
  [Key in keyof GameSpecificMap]: GameSpecificMap[Key] & { type: Key };
}[keyof GameSpecificMap];

type GameActions = {
  [Key in keyof GameSpecificMap]: GameSpecificMap[Key]["actions"];
};

// #endregion

// #region slice

export function createGameSlice(
  getToken: () => string,
  url?: string,
): StateCreator<GameSlice> {
  return function gameSlice(originalSet, get) {
    const set = function setGameSlice(
      mutation: Partial<GameSlice["game"]["mutable"]>,
    ) {
      originalSet((state) => ({
        game: {
          ...state.game,
          mutable: {
            ...state.game.mutable,
            ...mutation,
          },
        },
      }));
    };

    const callGuard = () => {
      const state = get().game.mutable;
      if (state.connected === false || state.gameIsOngoing === false) {
        return {
          connected: state.connected,
          gameIsOngoing: state.gameIsOngoing,
        };
      }
    };

    const actions = {
      "rock-paper-scissors": {
        chooseItem: (item: RockPaperScissorsItem) => {
          const error = callGuard();
          if (error !== undefined) {
            return error;
          }

          ws.send({
            type: "game-action",
            action: "choose",
            data: item,
            game: "rock-paper-scissors",
          });
        },
      },
    } satisfies GameActions;

    const onNewMessage = (message: WsMessageToClient) => {
      switch (message.type) {
        case "game-room":
          set({ room: message.data });
          return;
        case "game-logic":
          set({
            gameSpecific: {
              type: message.gameType,
              logic: message.data,
              actions: actions[message.gameType],
            },
          });
          if (message.data.roundResult !== undefined) {
            set({
              gameIsOngoing: false,
            });
          }
          return;
        case "join-game":
          set({
            gameIsOngoing: true,
          });
          return;
      }
    };

    const ws = new WSClient(
      onNewMessage,
      (connected) => {
        set({ connected });
      },
      getToken,
      url,
    );

    return {
      game: {
        mutable: {
          gameIsOngoing: false,
          connected: false,
        },
        joinGame: () => {
          const error = callGuard();
          if (error !== undefined) {
            return error;
          }

          ws.send({
            type: "connect-to-fight",
          });
        },

        pauseGame: () => {
          const error = callGuard();
          if (error !== undefined) {
            return error;
          }

          ws.send({
            type: "pause-game",
          });
        },

        resumeGame: () => {
          const error = callGuard();
          if (error !== undefined) {
            return error;
          }

          ws.send({
            type: "resume-game",
          });
        },

        markReady: () => {
          const error = callGuard();
          if (error !== undefined) {
            return error;
          }

          ws.send({
            type: "mark-ready",
          });
        },

        cleanup: () => {
          ws.close();
        },
      },
    };
  };
}

// #endregion
