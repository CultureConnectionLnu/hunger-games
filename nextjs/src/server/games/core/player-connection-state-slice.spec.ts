import { Temporal } from "temporal-polyfill";
import { describe, test, vi, beforeEach, afterEach, expect } from "vitest";
import { createStore } from "zustand";
import { createGameResultSlice } from "./game-result-slice";
import {
  createPlayerConnectionSlice,
  type PlayerConnectionSliceRequirements,
  registerPlayerConnectionSubscribers,
} from "./player-connection-state-slice";
import { createTimerSlice } from "./timer-slice";
import { subscribeWithSelector } from "zustand/middleware";
import { type SubscribeStore } from "./zustand-helper";

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

    test('should return "invalid player id" if the player id is invalid', async () => {
      const { connectPlayer, markReady, player1Id } = testSetup();

      connectPlayer(player1Id);
      expect(markReady("invalid-player-id")).toBe("invalid player id");
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

    test("should mark the game as running once both players are ready", async () => {
      const { getState, player1Id, player2Id, markReady, connectPlayer } =
        testSetup();

      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);

      expect(getState().playerConnection.mutable.gameIsRunning).toBe(true);
    });
  });

  describe("start timeout", () => {
    test("player 1 should win if only he joins the game", async () => {
      const { getState, player1Id, player2Id, connectPlayer, durations } =
        testSetup();
      connectPlayer(player1Id);

      await vi.advanceTimersByTimeAsync(
        durations.startTimeout.total({ unit: "milliseconds" }),
      );

      expect(getState().gameResult.outcome.result).toBe("winner");
      expect(getState().gameResult.outcome.reason).toBe("never-started");
      expect(getState().gameResult.outcome.winnerId).toBe(player1Id);
      expect(getState().gameResult.outcome.looserId).toBe(player2Id);
    });

    test("should be a tie if both players join the game", async () => {
      const { getState, player1Id, player2Id, connectPlayer, durations } =
        testSetup();
      connectPlayer(player1Id);
      connectPlayer(player2Id);

      await vi.advanceTimersByTimeAsync(
        durations.startTimeout.total({ unit: "milliseconds" }),
      );

      expect(getState().gameResult.outcome.result).toBe("tie");
      expect(getState().gameResult.outcome.reason).toBe("never-started");
      expect(getState().gameResult.outcome.winnerId).toBe(undefined);
      expect(getState().gameResult.outcome.looserId).toBe(undefined);
    });

    test("player 2 should win if only he marks himself as ready", async () => {
      const {
        getState,
        player1Id,
        player2Id,
        markReady,
        connectPlayer,
        durations,
      } = testSetup();
      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player2Id);

      await vi.advanceTimersByTimeAsync(
        durations.startTimeout.total({ unit: "milliseconds" }),
      );

      expect(getState().gameResult.outcome.result).toBe("winner");
      expect(getState().gameResult.outcome.reason).toBe("never-started");
      expect(getState().gameResult.outcome.winnerId).toBe(player2Id);
      expect(getState().gameResult.outcome.looserId).toBe(player1Id);
    });
  });

  describe("force stop timeout", () => {
    test("game should automatically end if nothing happens", async () => {
      const { getState, durations } = testSetup();

      await vi.advanceTimersByTimeAsync(
        durations.forceStop.total({ unit: "milliseconds" }),
      );

      expect(getState().gameResult.outcome.result).toBe("tie");
      expect(getState().gameResult.outcome.reason).toBe("force-stop-game");
      expect(getState().gameResult.outcome.winnerId).toBe(undefined);
      expect(getState().gameResult.outcome.looserId).toBe(undefined);
    });

    test("even if the game is ongoing, the game should be ended with the force stop timer", async () => {
      const {
        getState,
        player1Id,
        player2Id,
        connectPlayer,
        markReady,
        durations,
      } = testSetup();
      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);

      await vi.advanceTimersByTimeAsync(
        durations.forceStop.total({ unit: "milliseconds" }),
      );

      expect(getState().gameResult.outcome.result).toBe("tie");
      expect(getState().gameResult.outcome.reason).toBe("force-stop-game");
      expect(getState().gameResult.outcome.winnerId).toBe(undefined);
      expect(getState().gameResult.outcome.looserId).toBe(undefined);
    });
  });

  describe("player disconnected", () => {
    test("by default, should not mark players as disconnected", async () => {
      const { getState } = testSetup();
      expect(getState().playerConnection.mutable.player1.disconnected).toBe(
        false,
      );
      expect(getState().playerConnection.mutable.player2.disconnected).toBe(
        false,
      );
    });

    test('by default, should not start the "player disconnected loose" timer', async () => {
      const { getState } = testSetup();
      expect(getState().timerPlayer1DisconnectedLoose.mutable.isActive).toBe(
        false,
      );
      expect(getState().timerPlayer2DisconnectedLoose.mutable.isActive).toBe(
        false,
      );
    });

    test("should mark player 1 as disconnected", async () => {
      const { getState, player1Id, connectPlayer, disconnectPlayer } =
        testSetup();

      connectPlayer(player1Id);
      disconnectPlayer(player1Id);

      expect(getState().playerConnection.mutable.player1.disconnected).toBe(
        true,
      );
      expect(getState().timerPlayer1DisconnectedLoose.mutable.isActive).toBe(
        true,
      );
    });

    test('should return "player never joined" if the player tries to be disconnected before joining', async () => {
      const { disconnectPlayer } = testSetup();

      expect(disconnectPlayer("player1")).toBe("player never joined");
    });

    test('should return "invalid player id" if the player id is invalid', async () => {
      const { disconnectPlayer } = testSetup();

      expect(disconnectPlayer("invalid-player-id")).toBe("invalid player id");
    });

    test("should mark a running game as stopped upon a player disconnection", async () => {
      const {
        getState,
        player1Id,
        player2Id,
        connectPlayer,
        markReady,
        disconnectPlayer,
      } = testSetup();

      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);
      disconnectPlayer(player1Id);

      expect(getState().playerConnection.mutable.gameIsRunning).toBe(false);
    });

    test("player 1 looses if he disconnects for to long", async () => {
      const {
        getState,
        player1Id,
        player2Id,
        connectPlayer,
        markReady,
        disconnectPlayer,
        durations,
      } = testSetup();

      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);
      disconnectPlayer(player1Id);

      await vi.advanceTimersByTimeAsync(
        durations.disconnectLoose.total({ unit: "milliseconds" }),
      );

      expect(getState().gameResult.outcome.result).toBe("winner");
      expect(getState().gameResult.outcome.reason).toBe(
        "other-player-disconnected",
      );
      expect(getState().gameResult.outcome.winnerId).toBe(player2Id);
      expect(getState().gameResult.outcome.looserId).toBe(player1Id);
    });
  });

  describe("cleanup", () => {
    test("should cancel the timers upon game completion", async () => {
      const { getState, durations } = testSetup();

      await vi.advanceTimersByTimeAsync(
        durations.forceStop.total({ unit: "milliseconds" }),
      );

      await vi.advanceTimersByTimeAsync(
        durations.startTimeout.total({ unit: "milliseconds" }),
      );

      expect(getState().timerForceStopGame.mutable.canceled).toBe(true);
      expect(getState().timerStartTimeout.mutable.canceled).toBe(true);
      expect(getState().timerPlayer1DisconnectedLoose.mutable.canceled).toBe(
        true,
      );
      expect(getState().timerPlayer2DisconnectedLoose.mutable.canceled).toBe(
        true,
      );
    });
  });
});

function testSetup() {
  const player1Id = "player1";
  const player2Id = "player2";
  const durations = {
    forceStop: Temporal.Duration.from({ seconds: 120 }),
    disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
    startTimeout: Temporal.Duration.from({ seconds: 10 }),
  };
  const store = createStore<PlayerConnectionSliceRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createPlayerConnectionSlice(player1Id, player2Id)(...a),
      ...createGameResultSlice()(...a),
      ...createTimerSlice("timerForceStopGame", durations.forceStop, {
        shouldUpdateStateEverySecond: false,
      })(...a),
      ...createTimerSlice("timerStartTimeout", durations.startTimeout, {
        shouldUpdateStateEverySecond: false,
      })(...a),
      ...createTimerSlice(
        "timerPlayer1DisconnectedLoose",
        durations.disconnectLoose,
        {
          shouldUpdateStateEverySecond: false,
        },
      )(...a),
      ...createTimerSlice(
        "timerPlayer2DisconnectedLoose",
        durations.disconnectLoose,
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
    durations,
  };
}
