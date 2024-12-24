import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createPlayerConnectionRequirement } from "../core/creator";
import { createTimerSlice } from "../core/timer-slice";
import { type SubscribeStore } from "../core/zustand-helper";
import {
  createRockPaperScissorsSlice,
  registerRockPaperScissorsSubscribers,
  type RockPaperScissorsRequirements,
} from "./rock-paper-scissors-slice";

describe("rock paper scissors slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("by default, players can't choose", async () => {
    const { getState } = testSetup();

    expect(getState().gameLogic.mutable.player1.canChoose).toBe(false);
    expect(getState().gameLogic.mutable.player2.canChoose).toBe(false);
  });
});

function testSetup() {
  const player1Id = "player1";
  const player2Id = "player2";
  const durations = {
    chooseTimeout: Temporal.Duration.from({ seconds: 10 }),
    showCurrentScore: Temporal.Duration.from({ seconds: 10 }),
  };
  const store = createStore<RockPaperScissorsRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createRockPaperScissorsSlice(player1Id, player2Id)(...a),
      ...createTimerSlice("timerRpsChooseTimeout", durations.chooseTimeout, {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      })(...a),
      ...createTimerSlice("timerRpsShowCurrentScore", durations.chooseTimeout, {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      })(...a),
      ...createPlayerConnectionRequirement(player1Id, player2Id, {
        forceStop: Temporal.Duration.from({ seconds: 120 }),
        disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
        startTimeout: Temporal.Duration.from({ seconds: 10 }),
      })(...a),
    })),
  );

  registerRockPaperScissorsSubscribers(
    store as SubscribeStore<RockPaperScissorsRequirements>,
  );

  const getState = () => {
    return store.getState();
  };

  return {
    getState,
    player1Id,
    player2Id,
    chooseItem: getState().gameLogic,
    durations,
  };
}
