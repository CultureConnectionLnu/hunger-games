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
    test("by default, it shows 'joining' as the view", async () => {
      const { getState } = testSetup();

      expect(getState().connectedView.mutable.player1.showView).toBe("joining");
      expect(getState().connectedView.mutable.player2.showView).toBe("joining");
    });

    test("should switch the view to 'ready-button' when the player joins", async () => {
      const { getState, player1Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);

      expect(getState().connectedView.mutable.player1.showView).toBe(
        "ready-button",
      );
      expect(getState().connectedView.mutable.player2.showView).toBe("joining");
    });

    test("should switch the view to 'waiting-for-other-player-joining' when the player is ready", async () => {
      const { getState, player1Id, connectPlayer, markReady } = testSetup();

      connectPlayer(player1Id);
      markReady(player1Id);

      expect(getState().connectedView.mutable.player1.showView).toBe(
        "waiting-for-other-player-joining",
      );
      expect(getState().connectedView.mutable.player2.showView).toBe("joining");
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
  });

  describe("next actions", () => {
    test("by default, no action should be available", async () => {
      const { getState } = testSetup();

      expect(getState().connectedView.mutable.player1.nextActions).toEqual([]);
    });

    test("when entering the ready-button view, the next action should be 'ready'", async () => {
      const { getState, player1Id, connectPlayer } = testSetup();

      connectPlayer(player1Id);

      expect(getState().connectedView.mutable.player1.nextActions).toEqual([
        "ready",
      ]);
      expect(getState().connectedView.mutable.player2.nextActions).toEqual([]);
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
