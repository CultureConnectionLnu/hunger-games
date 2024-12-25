/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type Temporal } from "temporal-polyfill";
import { createGameResultSlice } from "./game-result-slice";
import { createPlayerConnectionSlice } from "./player-connection-state-slice";
import { createTimerSlice } from "./timer-slice";
import {
  createRockPaperScissorsSlice,
  type RockPaperScissorsOptions,
} from "../games/rock-paper-scissors-slice";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AcceptedAny = any;

export function createPlayerConnectionRequirement(
  player1Id: string,
  player2Id: string,
  durations: {
    forceStop: Temporal.Duration;
    disconnectLoose: Temporal.Duration;
    startTimeout: Temporal.Duration;
  },
) {
  return (set: AcceptedAny, get: AcceptedAny, write: AcceptedAny) => ({
    ...createPlayerConnectionSlice(player1Id, player2Id)(set, get, write),
    ...createGameResultSlice()(set, get, write),
    ...createTimerSlice("timerForceStopGame", durations.forceStop, {
      shouldUpdateStateEverySecond: false,
    })(set, get, write),
    ...createTimerSlice("timerStartTimeout", durations.startTimeout, {
      shouldUpdateStateEverySecond: true,
      countDirection: "down-from-end",
    })(set, get, write),
    ...createTimerSlice(
      "timerPlayer1DisconnectedLoose",
      durations.disconnectLoose,
      {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      },
    )(set, get, write),
    ...createTimerSlice(
      "timerPlayer2DisconnectedLoose",
      durations.disconnectLoose,
      {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      },
    )(set, get, write),
  });
}

// #region game requirements

export function createRockPaperScissorsRequirement(
  player1Id: string,
  player2Id: string,
  roomOptions: {
    forceStop: Temporal.Duration;
    disconnectLoose: Temporal.Duration;
    startTimeout: Temporal.Duration;
  },
  gameOptions: {
    durations: {
      chooseTimeout: Temporal.Duration;
      roundResult: Temporal.Duration;
    };
  } & RockPaperScissorsOptions,
) {
  return (set: AcceptedAny, get: AcceptedAny, write: AcceptedAny) => ({
    ...createRockPaperScissorsSlice(player1Id, player2Id, {
      roundsNeededToWin: gameOptions.roundsNeededToWin,
      roundsLimit: gameOptions.roundsLimit,
    })(set, get, write),
    ...createTimerSlice(
      "timerRpsChooseTimeout",
      gameOptions.durations.chooseTimeout,
      {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      },
    )(set, get, write),
    ...createTimerSlice(
      "timerRpsShowCurrentScore",
      gameOptions.durations.roundResult,
      {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      },
    )(set, get, write),
    ...createPlayerConnectionRequirement(player1Id, player2Id, roomOptions)(
      set,
      get,
      write,
    ),
  });
}

// #endregion
