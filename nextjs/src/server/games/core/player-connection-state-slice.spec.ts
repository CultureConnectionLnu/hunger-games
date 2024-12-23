import { Temporal } from "temporal-polyfill";
import { describe, test, vi, beforeEach, afterEach, expect } from "vitest";
import { createStore } from "zustand";
import { createGameResultSlice } from "./game-result-slice";
import {
  createPlayerConnectionSlice,
  PlayerConnectionSliceRequirements,
  registerPlayerConnectionSubscribers,
} from "./player-connection-state-slice";
import { createTimerSlice } from "./timer-slice";
import { subscribeWithSelector } from "zustand/middleware";
import { SubscribeStore } from "./zustand-helper";

describe("player connection slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("by default, the game is not running", async () => {
    const { getState } = testSetup();
    expect(getState().playerConnection.mutable.gameIsRunning).toBe(false);
  });

  describe("joining the game", () => {
    test("by default, both players did not join", async () => {
      const { getState } = testSetup();
      expect(getState().playerConnection.mutable.player1.joined).toBe(false);
      expect(getState().playerConnection.mutable.player2.joined).toBe(false);
    });

    test('by default, should not start the "start timeout" timer', async () => {
      const { getState } = testSetup();
      expect(getState().timerStartTimeout.mutable.isActive).toBe(false);
    });

    test("should join player1", async () => {
      const { getState, player1Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);

      expect(getState().playerConnection.mutable.player1.joined).toBe(true);
      expect(getState().playerConnection.mutable.player2.joined).toBe(false);
    });

    test('should start the "start timeout" timer as soon as the first player joins', async () => {
      const { getState, player1Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);
      expect(getState().timerStartTimeout.mutable.isActive).toBe(true);
    });

    test("nothing changes if both players join", async () => {
      const { getState, player1Id, player2Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);
      connectPlayer(player2Id);

      expect(getState().playerConnection.mutable.player1.joined).toBe(true);
      expect(getState().playerConnection.mutable.player2.joined).toBe(true);
      expect(getState().timerStartTimeout.mutable.isActive).toBe(true);
    });

    test('should return "invalid player id" if the player id is invalid', async () => {
      const { connectPlayer } = testSetup();

      expect(connectPlayer("invalid-player-id")).toBe("invalid player id");
    });

    test('should return "already joined" if the player is already joined', async () => {
      const { player1Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);

      expect(connectPlayer(player1Id)).toBe("player already joined");
    });
  });

  describe("ready the game", () => {
    test("by default, both players are not ready", async () => {
      const { getState } = testSetup();
      expect(getState().playerConnection.mutable.player1.ready).toBe(false);
      expect(getState().playerConnection.mutable.player2.ready).toBe(false);
    });

    test("should return 'player not joined' if the player tries to be ready before joining", async () => {
      const { markReady, player1Id } = testSetup();
      expect(markReady(player1Id)).toBe("player not joined");
    });

    test("should mark player1 as ready", async () => {
      const { getState, player1Id, markReady, connectPlayer } = testSetup();

      connectPlayer(player1Id);
      markReady(player1Id);

      expect(getState().playerConnection.mutable.player1.ready).toBe(true);
      expect(getState().playerConnection.mutable.player2.ready).toBe(false);
    });

    test("should return 'player already ready' if the player tries to mark themselves as ready", async () => {
      const { player1Id, markReady, connectPlayer } = testSetup();
      connectPlayer(player1Id);
      markReady(player1Id);
      expect(markReady(player1Id)).toBe("player already ready");
    });

    test('should cancel the "start timeout" timer once both players are ready', async () => {
      const { getState, player1Id, player2Id, markReady, connectPlayer } =
        testSetup();

      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);

      expect(getState().timerStartTimeout.mutable.isActive).toBe(false);
    });
  });
});

function testSetup({}: {} = {}) {
  const player1Id = "player1";
  const player2Id = "player2";
  const store = createStore<PlayerConnectionSliceRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createPlayerConnectionSlice(player1Id, player2Id)(...a),
      ...createGameResultSlice()(...a),
      ...createTimerSlice(
        "timerForceStopGame",
        Temporal.Duration.from({ seconds: 120 }),
        {
          shouldUpdateStateEverySecond: false,
        },
      )(...a),
      ...createTimerSlice(
        "timerStartTimeout",
        Temporal.Duration.from({ seconds: 10 }),
        {
          shouldUpdateStateEverySecond: false,
        },
      )(...a),
      ...createTimerSlice(
        "timerPlayer1DisconnectedLoose",
        Temporal.Duration.from({ seconds: 10 }),
        {
          shouldUpdateStateEverySecond: false,
        },
      )(...a),
      ...createTimerSlice(
        "timerPlayer2DisconnectedLoose",
        Temporal.Duration.from({ seconds: 10 }),
        {
          shouldUpdateStateEverySecond: false,
        },
      )(...a),
    })),
  );

  registerPlayerConnectionSubscribers(
    store as SubscribeStore<PlayerConnectionSliceRequirements>,
  );

  const getState = () => {
    return store.getState();
  };

  const { connectPlayer, disconnectPlayer, markReady } =
    getState().playerConnection;

  return {
    getState,
    player1Id,
    player2Id,
    connectPlayer,
    disconnectPlayer,
    markReady,
  };
}
