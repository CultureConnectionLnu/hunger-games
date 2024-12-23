import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  createConnectionViewSlice,
  registerConnectionViewSubscribers,
  type ConnectedViewRequirements,
} from "./connection-view-slice";
import { createGameResultSlice } from "./game-result-slice";
import {
  createPlayerConnectionSlice,
  registerPlayerConnectionSubscribers,
} from "./player-connection-state-slice";
import { createTimerSlice } from "./timer-slice";
import { type SubscribeStore } from "./zustand-helper";

describe("connection view slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("view", () => {
    describe("before game starts", () => {
      test("by default, it shows 'joining' as the view", async () => {
        const { getState } = testSetup();

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "joining",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "joining",
        );
      });

      test("should switch the view to 'ready-button' when the player joins", async () => {
        const { getState, player1Id, connectPlayer } = testSetup();

        connectPlayer(player1Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "ready-button",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "joining",
        );
      });

      test("should switch the view to 'waiting-for-other-player-joining' when the player is ready", async () => {
        const { getState, player1Id, connectPlayer, markReady } = testSetup();

        connectPlayer(player1Id);
        markReady(player1Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "waiting-for-other-player-joining",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "joining",
        );
      });

      test('should switch the view to "waiting-for-other-player-ready" once the opponent joins', async () => {
        const { getState, player1Id, player2Id, connectPlayer, markReady } =
          testSetup();

        connectPlayer(player1Id);
        markReady(player1Id);
        connectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "waiting-for-other-player-ready",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "ready-button",
        );
      });

      test('should switch the view to "waiting-for-other-player-ready" once the opponent joins (alternative order)', async () => {
        const { getState, player1Id, player2Id, connectPlayer, markReady } =
          testSetup();

        connectPlayer(player1Id);
        connectPlayer(player2Id);
        markReady(player1Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "waiting-for-other-player-ready",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "ready-button",
        );
      });

      test('should switch the view to "waiting-for-other-player-reconnect" once the opponent disconnects', async () => {
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
        disconnectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "waiting-for-other-player-reconnect",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "ready-button",
        );
      });

      test('should switch the view to "waiting-for-other-player-reconnect" once the opponent disconnects (alternative order)', async () => {
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
        disconnectPlayer(player2Id);
        markReady(player1Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "waiting-for-other-player-reconnect",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "ready-button",
        );
      });

      test('should switch back to "waiting-for-other-player-ready" once the opponent reconnects', async () => {
        const {
          getState,
          player1Id,
          player2Id,
          connectPlayer,
          markReady,
          disconnectPlayer,
        } = testSetup();

        connectPlayer(player1Id);
        markReady(player1Id);
        connectPlayer(player2Id);
        disconnectPlayer(player2Id);
        connectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "waiting-for-other-player-ready",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "ready-button",
        );
      });
    });

    describe("while game is running", () => {
      test('should switch the view to "game" once both players are ready', async () => {
        const { getState, player1Id, player2Id, connectPlayer, markReady } =
          testSetup();

        connectPlayer(player1Id);
        connectPlayer(player2Id);
        markReady(player1Id);
        markReady(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe("game");
        expect(getState().connectedView.mutable.player2.showView).toBe("game");
      });

      test("should switch the view to 'game-paused' when a player disconnects", async () => {
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

        disconnectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "game-paused",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "game-paused",
        );
      });

      test("should continue to show 'game-paused' both players are disconnected", async () => {
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
        disconnectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "game-paused",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "game-paused",
        );
      });

      test("should stay paused when only one player reconnects", async () => {
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
        disconnectPlayer(player2Id);

        connectPlayer(player1Id);

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "game-paused",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "game-paused",
        );
      });

      test("should switch back to 'game' when both players reconnect", async () => {
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
        disconnectPlayer(player2Id);

        connectPlayer(player1Id);
        connectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.showView).toBe("game");
        expect(getState().connectedView.mutable.player2.showView).toBe("game");
      });
    });

    describe("after game", () => {
      test('should show "game-ended" view', async () => {
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

        expect(getState().connectedView.mutable.player1.showView).toBe(
          "game-ended",
        );
        expect(getState().connectedView.mutable.player2.showView).toBe(
          "game-ended",
        );
      });
    });
  });

  describe("next actions", () => {
    describe("before game starts", () => {
      test("by default, no action should be available", async () => {
        const { getState } = testSetup();

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });

      test("when entering the ready-button view, the next action should be 'ready'", async () => {
        const { getState, player1Id, connectPlayer } = testSetup();

        connectPlayer(player1Id);

        expect(getState().connectedView.mutable.player1.nextActions).toEqual([
          "ready",
        ]);
        expect(getState().connectedView.mutable.player2.nextActions).toEqual(
          [],
        );
      });

      test('should have no actions for the view "waiting-for-other-player-joining"', async () => {
        const { getState, player1Id, connectPlayer, markReady } = testSetup();

        connectPlayer(player1Id);
        markReady(player1Id);

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });

      test('should have no actions for the view "waiting-for-other-player-ready"', async () => {
        const { getState, player1Id, player2Id, connectPlayer, markReady } =
          testSetup();

        connectPlayer(player1Id);
        connectPlayer(player2Id);
        markReady(player1Id);

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });

      test('should have no actions for the view "waiting-for-other-player-reconnect"', async () => {
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
        disconnectPlayer(player2Id);

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });
    });

    describe("while game is running", () => {
      test('should have no actions for the view "game"', async () => {
        const { getState, player1Id, player2Id, connectPlayer, markReady } =
          testSetup();
        connectPlayer(player1Id);
        connectPlayer(player2Id);
        markReady(player1Id);
        markReady(player2Id);

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });

      test('should have no actions for the view "game-paused"', async () => {
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

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });
    });

    describe("after game", () => {
      test("should have no actions for the view 'game-ended'", async () => {
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

        expect(getState().connectedView.mutable.player1.nextActions).toEqual(
          [],
        );
      });
    });
  });

  describe("timers", () => {
    test("by default, should not show any timer", async () => {
      const { getState } = testSetup();

      expect(
        getState().connectedView.mutable.player1.timer.startTimeout.visible,
      ).toBe(false);
      expect(
        getState().connectedView.mutable.player1.timer.otherPlayerDisconnect
          .visible,
      ).toBe(false);
    });

    test("when entering the ready-button view, then the startTimeout timer is shown", async () => {
      const { getState, player1Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);

      expect(
        getState().connectedView.mutable.player1.timer.startTimeout.visible,
      ).toBe(true);
      expect(
        getState().connectedView.mutable.player1.timer.otherPlayerDisconnect
          .visible,
      ).toBe(false);

      expect(
        getState().connectedView.mutable.player2.timer.startTimeout.visible,
      ).toBe(false);
    });
  });

  describe("outcome", () => {
    test("by default, should not show any outcome", async () => {
      const { getState } = testSetup();

      expect(getState().connectedView.mutable.player1.outcome).toBe(undefined);
      expect(getState().connectedView.mutable.player2.outcome).toBe(undefined);
    });

    test("should show outcome 'tie' when both players are in the same state", async () => {
      const { getState, player1Id, player2Id, connectPlayer, durations } =
        testSetup();

      connectPlayer(player1Id);
      connectPlayer(player2Id);

      await vi.advanceTimersByTimeAsync(
        durations.startTimeout.total({ unit: "milliseconds" }),
      );

      expect(getState().connectedView.mutable.player1.outcome).toEqual({
        result: "tie",
        yourId: player1Id,
        opponentId: player2Id,
        reason: "never-started",
      });
      expect(getState().connectedView.mutable.player2.outcome).toEqual({
        result: "tie",
        yourId: player2Id,
        opponentId: player1Id,
        reason: "never-started",
      });
    });

    test("should show outcome 'win' when the player who is not in the same state wins", async () => {
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

      await vi.advanceTimersByTimeAsync(
        durations.startTimeout.total({ unit: "milliseconds" }),
      );

      expect(getState().connectedView.mutable.player1.outcome).toEqual({
        result: "win",
        yourId: player1Id,
        opponentId: player2Id,
        reason: "never-started",
      });
      expect(getState().connectedView.mutable.player2.outcome).toEqual({
        result: "loose",
        yourId: player2Id,
        opponentId: player1Id,
        reason: "never-started",
      });
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
  const store = createStore<ConnectedViewRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createConnectionViewSlice(player1Id, player2Id)(...a),
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
    store as SubscribeStore<ConnectedViewRequirements>,
  );
  registerConnectionViewSubscribers(
    store as SubscribeStore<ConnectedViewRequirements>,
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
