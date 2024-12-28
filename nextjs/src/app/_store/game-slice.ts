import { type StateCreator } from "zustand";
import { type GameType } from "~/server/stores/games/game-factory";
import { type RockPaperScissorsItem } from "~/server/stores/games/rock-paper-scissors-slice";
import { type WsMessageToClient } from "~/server/web-socket-connection";
import { type AcceptedAny } from "~/type-utils";
import { WSClient } from "./ws-client";

// #region types

type GetType<
  Message extends WsMessageToClient,
  Type extends Message["type"],
> = Message extends {
  type: Type;
}
  ? Message
  : never;

type ErrorMessage = Omit<GetType<WsMessageToClient, "error">, "type"> & {
  id: string;
};
type RoomMessage = GetType<WsMessageToClient, "game-room">["data"];
type GameLogicMessage = GetType<WsMessageToClient, "game-logic">;

export interface GameSlice {
  game: {
    mutable: {
      room?: RoomMessage;
      gameSpecific?: GameSpecific;
      errors: ErrorMessage[];
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
    /**
     * Remove an error from the error list.
     */
    ackError: (id: string) => void;
  };
}

type WsCallResult =
  | undefined
  | {
      connected: boolean;
      gameIsOngoing: boolean;
    };
type WsCall<Param extends Array<AcceptedAny> = []> = (
  ...param: Param
) => WsCallResult;

type GetSpecificGameLogicMessage<GT extends GameType> =
  GameLogicMessage extends {
    gameType: GT;
  }
    ? GameLogicMessage["data"]
    : never;

type GameSpecificMap = {
  "rock-paper-scissors": {
    actions: {
      chooseItem: WsCall<[RockPaperScissorsItem]>;
    };
    logic: GetSpecificGameLogicMessage<"rock-paper-scissors">;
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
  getToken: () => Promise<string>,
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

    let errorCounter = 0;

    const onNewMessage = (message: WsMessageToClient) => {
      switch (message.type) {
        case "game-room":
          set({ room: message.data, gameIsOngoing: true });
          return;
        case "game-logic":
          set({
            gameSpecific: {
              type: message.gameType,
              logic: message.data,
              actions: actions[message.gameType],
            },
            gameIsOngoing: true,
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
        case "error":
          set({
            errors: [
              ...get().game.mutable.errors,
              { ...message, id: String(errorCounter++) },
            ],
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
          errors: [],
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

        ackError: (id: string) => {
          set({
            errors: get().game.mutable.errors.filter(
              (error) => error.id !== id,
            ),
          });
        },
      },
    } satisfies GameSlice;
  };
}

// #endregion
