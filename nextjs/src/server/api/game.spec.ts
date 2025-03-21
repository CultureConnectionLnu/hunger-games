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
      actionTest(async () => {
        clerkTesting.mockAuth("player1");
        const matchId = (
          await startGame({ opponentId: clerkTesting.testUserMap.player2 })
        )._unsafeUnwrap();
        await expect(getAllMyMatches()).resolves.toOk([
          {
            matchId,
            game: "rock-paper-scissors",
            opponentId: clerkTesting.testUserMap.player2,
            reason: "ongoing",
            result: null,
            youWon: false,
          },
        ]);
      }),
    );
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
});
