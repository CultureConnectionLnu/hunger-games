import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { clerkTesting } from "../auth/clerk";
import { getAllMyMatches, startGame } from "./game";
import { actionTest } from "../testing";

describe("game api", () => {
  beforeAll(() => {
    clerkTesting.enableMockAuth(true);
  });

  afterAll(() => {
    clerkTesting.enableMockAuth(false);
  });

  describe("startGame", () => {
    test(
      "should return forbidden when not logged in",
      actionTest(async () => {
        clerkTesting.mockAuth("none");
        await expect(startGame({ opponentId: "player1" })).resolves.toErr({
          code: "FORBIDDEN",
          reason: "You are not authorized to access this resource",
        });
      }),
    );

    test(
      "should return forbidden when the user is not a player",
      actionTest(async () => {
        clerkTesting.mockAuth("user1");
        await expect(startGame({ opponentId: "player1" })).resolves.toErr({
          code: "FORBIDDEN",
          reason: "You are not authorized to access this resource",
        });
      }),
    );

    test(
      "should return error when the opponent is not a user",
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        await expect(startGame({ opponentId: "unknown" })).resolves.toErr({
          code: "BAD_REQUEST",
          reason: "OPPONENT_NOT_FOUND",
        });
      }),
    );

    test(
      "should return error when the opponent is the same as the user",
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        await expect(
          startGame({ opponentId: clerkTesting.testUserMap.player1 }),
        ).resolves.toErr({
          code: "BAD_REQUEST",
          reason: "CANNOT_PLAY_AGAINST_YOURSELF",
        });
      }),
    );

    test(
      "should create game",
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        await expect(
          startGame({ opponentId: clerkTesting.testUserMap.player2 }),
        ).resolves.toOk();
      }),
    );

    test(
      "should return an error when the current player already has an ongoing game",
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        await startGame({ opponentId: clerkTesting.testUserMap.player2 });
        await expect(
          startGame({ opponentId: clerkTesting.testUserMap.player3 }),
        ).resolves.toErr({
          code: "BAD_REQUEST",
          reason: "YOU_ARE_ALREADY_IN_GAME",
        });
      }),
    );

    test(
      "should return an error when the opponent already has an ongoing game",
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        await startGame({ opponentId: clerkTesting.testUserMap.player2 });

        clerkTesting.mockAuth("player3");
        await expect(
          startGame({ opponentId: clerkTesting.testUserMap.player2 }),
        ).resolves.toErr({
          code: "BAD_REQUEST",
          reason: "OPPONENT_IS_ALREADY_IN_GAME",
        });
      }),
    );
  });

  describe("getAllMyMatches", () => {
    test(
      "should return forbidden when not logged in",
      actionTest(async () => {
        clerkTesting.mockAuth("none");
        await expect(getAllMyMatches()).resolves.toErr({
          code: "FORBIDDEN",
          reason: "You are not authorized to access this resource",
        });
      }),
    );

    test(
      "should return forbidden when the user is not a player",
      actionTest(async () => {
        clerkTesting.mockAuth("user1");
        await expect(getAllMyMatches()).resolves.toErr({
          code: "FORBIDDEN",
          reason: "You are not authorized to access this resource",
        });
      }),
    );

    test(
      "should return no matches for a player with no matches",
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        await expect(getAllMyMatches()).resolves.toOk([]);
      }),
    );

    test(
      "should return the currently running match",
      actionTest(async (helper) => {
        clerkTesting.mockAuth("player1");
        const meta = (await helper.startGame("player2")).getMeta();

        await expect(getAllMyMatches()).resolves.toOk([
          {
            ...meta,
            reason: "ongoing",
            result: null,
            youWon: false,
          },
        ]);
      }),
    );

    test(
      "should show the finished match",
      actionTest(async (helper) => {
        clerkTesting.mockAuth("player1");
        const meta = await helper
          .startGame("player2")
          .then((game) => game.fakeWin("initiator"))
          .then((game) => game.getMeta());

        await expect(getAllMyMatches()).resolves.toOk([
          {
            ...meta,
            reason: "game-result",
            result: "winner",
            youWon: true,
          },
        ]);
      }),
    );

    test(
      "should show past matches and the currently ongoing one",
      actionTest(async (helper) => {
        clerkTesting.mockAuth("player1");
        const firstWin = await helper
          .startGame("player2")
          .then((game) => game.fakeWin("initiator"))
          .then((game) => game.getMeta());

        const firstLoose = await helper
          .startGame("player2")
          .then((game) => game.fakeWin("opponent"))
          .then((game) => game.getMeta());

        const neverStarted = await helper
          .startGame("player3")
          .then((game) => game.fakeNeverStarted("opponent"))
          .then((game) => game.getMeta());

        const neverStartedTie = await helper
          .startGame("player3")
          .then((game) => game.fakeNeverStarted())
          .then((game) => game.getMeta());

        const disconnectWin = await helper
          .startGame("player3")
          .then((game) => game.fakePlayerDisconnected("initiator"))
          .then((game) => game.getMeta());

        const ongoing = (await helper.startGame("player2")).getMeta();

        await expect(getAllMyMatches()).resolves.toOk([
          {
            ...firstWin,
            reason: "game-result",
            result: "winner",
            youWon: true,
          },
          {
            ...firstLoose,
            reason: "game-result",
            result: "winner",
            youWon: false,
          },
          {
            ...neverStarted,
            reason: "never-started",
            result: "winner",
            youWon: false,
          },
          {
            ...neverStartedTie,
            reason: "never-started",
            result: "tie",
            youWon: false,
          },
          {
            ...disconnectWin,
            reason: "other-player-disconnected",
            result: "winner",
            youWon: true,
          },
          {
            ...ongoing,
            reason: "ongoing",
            result: null,
            youWon: false,
          },
        ]);
      }),
    );
  });
});
