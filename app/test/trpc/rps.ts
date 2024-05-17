/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it, vi } from "vitest";
import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game";
import {
  type RockPaperScissorsGameInstance,
  lobbyHandler,
} from "~/server/api/logic/handler";
import type { RockPaperScissorsPlayerEvents } from "~/server/api/routers/games/rock-paper-scissors";
import {
  cleanupLeftovers,
  expectEventEmitted,
  getLastEventOf,
  getManualTimer,
  getTestUserCallers,
  makePlayer,
  runAllMacroTasks,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

export const rpsTests = () =>
  describe("Rock Paper Scissors", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    describe("Evaluation", () => {
      it("should be a draw if no one chooses", () =>
        testFight(async ({ startGame, firstRpsListener, timer }) => {
          await startGame();

          timer.getFirstByName("choose-timer").emitTimeout();

          expectEventEmitted(firstRpsListener, "show-result");
          const event = getLastEventOf(firstRpsListener, "show-result");
          expect(event?.data).toEqual({
            outcome: "draw",
            anotherRound: true,
            wins: 0,
            loses: 0,
            yourName: "Test User 1",
            opponentName: "Test User 2",
          });
        }));

      it("if only one player chooses, then he is the winner", () =>
        testFight(async ({ startGame, firstRpsListener, timer, choose }) => {
          await startGame();
          await choose("test_user_1", "rock");

          timer.getFirstByName("choose-timer").emitTimeout();

          expectEventEmitted(firstRpsListener, "show-result");
          const event = getLastEventOf(firstRpsListener, "show-result");
          expect(event?.data).toEqual({
            outcome: "win",
            anotherRound: true,
            wins: 1,
            loses: 0,
            yourName: "Test User 1",
            opponentName: "Test User 2",
          });
        }));

      it("if both player choose the same item, then it is a draw", () =>
        testFight(async ({ startGame, firstRpsListener, timer, choose }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          timer.getFirstByName("choose-timer").emitTimeout();

          expectEventEmitted(firstRpsListener, "show-result");
          const event = getLastEventOf(firstRpsListener, "show-result");
          expect(event?.data).toEqual({
            outcome: "draw",
            anotherRound: true,
            wins: 0,
            loses: 0,
            yourName: "Test User 1",
            opponentName: "Test User 2",
          });
        }));

      (
        [
          {
            p1: "rock",
            p2: "scissors",
            wins: 1,
            loses: 0,
            outcome: "win",
          },
          {
            p1: "scissors",
            p2: "paper",
            wins: 1,
            loses: 0,
            outcome: "win",
          },
          {
            p1: "paper",
            p2: "rock",
            wins: 1,
            loses: 0,
            outcome: "win",
          },
          {
            p1: "scissors",
            p2: "rock",
            wins: 0,
            loses: 1,
            outcome: "lose",
          },
          {
            p1: "paper",
            p2: "scissors",
            wins: 0,
            loses: 1,
            outcome: "lose",
          },
          {
            p1: "rock",
            p2: "paper",
            wins: 0,
            loses: 1,
            outcome: "lose",
          },
        ] satisfies Array<{
          p1: "rock" | "paper" | "scissors";
          p2: "rock" | "paper" | "scissors";
          wins: number;
          loses: number;
          outcome: "win" | "draw" | "lose";
        }>
      ).forEach((x) => {
        it(`if player 1 chooses "${x.p1}" and player 2 chooses "${x.p2}", then player 1 ${x.outcome === "win" ? "wins" : "loses"}`, () =>
          testFight(async ({ startGame, firstRpsListener, choose }) => {
            await startGame();
            await choose("test_user_1", x.p1);
            await choose("test_user_2", x.p2);

            expectEventEmitted(firstRpsListener, "show-result");
            const event = getLastEventOf(firstRpsListener, "show-result");
            expect(event?.data).toEqual({
              outcome: x.outcome,
              anotherRound: true,
              wins: x.wins,
              loses: x.loses,

              yourName: "Test User 1",
              opponentName: "Test User 2",
            });
          }));
      });

      it("if a player wins 3 times, then he is the overall winner", () =>
        testFight(async ({ startGame, choose, timer, firstListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "scissors");
          timer.getLastRunningByName("next-round-timer").emitTimeout();

          await choose("test_user_1", "rock");
          await choose("test_user_2", "scissors");
          timer.getLastRunningByName("next-round-timer").emitTimeout();

          await choose("test_user_1", "rock");
          await choose("test_user_2", "scissors");

          expectEventEmitted(firstListener, "game-ended");
          const event = getLastEventOf(firstListener, "game-ended");
          expect(event?.data).toEqual({
            winnerId: "test_user_1",
            loserId: "test_user_2",
          });
        }));
    });

    describe("Views", () => {
      it("should show choose view", () =>
        testFight(
          async ({ startGame, firstRpsListener, secondRpsListener }) => {
            await startGame();

            expect(
              getLastEventOf(firstRpsListener, "enable-choose")?.view,
            ).toEqual("start-choose");
            expect(
              getLastEventOf(secondRpsListener, "enable-choose")?.view,
            ).toEqual("start-choose");
          },
        ));

      it("should show chosen screen upon selection", () =>
        testFight(
          async ({
            startGame,
            firstRpsListener,
            choose,
            secondRpsListener,
          }) => {
            await startGame();
            await choose("test_user_1", "rock");

            expect(
              getLastEventOf(firstRpsListener, "show-waiting")?.view,
            ).toEqual("chosen");

            expect(
              getLastEventOf(secondRpsListener, "enable-choose")?.view,
            ).toEqual("start-choose");
          },
        ));

      it("should show result screen once all have chosen", () =>
        testFight(
          async ({
            startGame,
            firstRpsListener,
            choose,
            secondRpsListener,
          }) => {
            await startGame();
            await choose("test_user_1", "rock");
            await choose("test_user_2", "rock");

            expect(
              getLastEventOf(firstRpsListener, "show-result")?.view,
            ).toEqual("show-result");

            expect(
              getLastEventOf(secondRpsListener, "show-result")?.view,
            ).toEqual("show-result");
          },
        ));

      it("should show choose again after next round timer is done", () =>
        testFight(
          async ({
            startGame,
            choose,
            timer,
            firstRpsListener,
            secondRpsListener,
          }) => {
            await startGame();
            await choose("test_user_1", "rock");
            await choose("test_user_2", "rock");
            timer.getLastRunningByName("next-round-timer").emitTimeout();

            expect(
              getLastEventOf(firstRpsListener, "enable-choose")?.view,
            ).toEqual("start-choose");

            expect(
              getLastEventOf(secondRpsListener, "enable-choose")?.view,
            ).toEqual("start-choose");
          },
        ));
    });

    describe("Timers", () => {
      it("should start choose timer", () =>
        testFight(async ({ startGame, timer, firstRpsListener }) => {
          await startGame();

          expect(() =>
            timer.getLastRunningByName("choose-timer"),
          ).not.toThrow();
          expect(
            getLastEventOf(firstRpsListener, "choose-timer")?.data.secondsLeft,
          ).toBeGreaterThan(0);
        }));

      it("should stop choose timer once everyone has chosen", () =>
        testFight(async ({ startGame, choose, timer, firstRpsListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          const chooseTimer = timer.getLastByName("choose-timer");

          expect(chooseTimer.isCanceled).toBeTruthy();
          expect(
            getLastEventOf(firstRpsListener, "choose-timer")?.data.secondsLeft,
          ).toBe(0);
        }));

      it("should not start next round timer before everyone has chosen", () =>
        testFight(async ({ startGame, timer }) => {
          await startGame();

          expect(() =>
            timer.getLastRunningByName("next-round-timer"),
          ).toThrow();
        }));

      it("should start next round timer once everyone has chosen", () =>
        testFight(async ({ startGame, choose, timer, firstRpsListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          expect(() =>
            timer.getLastRunningByName("next-round-timer"),
          ).not.toThrow();
          expect(
            getLastEventOf(firstRpsListener, "next-round-timer")?.data
              .secondsLeft,
          ).toBeGreaterThan(0);
        }));

      it("should restart choose timer once next round timer is done", () =>
        testFight(async ({ startGame, choose, timer, firstRpsListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          const nextRoundTimer = timer.getLastRunningByName("next-round-timer");
          await timer.simulateNormalTimeout(nextRoundTimer);

          expect(timer.getLastByName("choose-timer").isCanceled).toBeFalsy();
          expect(
            getLastEventOf(firstRpsListener, "next-round-timer")?.data
              .secondsLeft,
          ).toBe(0);
          expect(
            getLastEventOf(firstRpsListener, "choose-timer")?.data.secondsLeft,
          ).toBeGreaterThan(0);
        }));
    });
  });

async function testFight(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  useManualTimer();
  const args = await setupTest();

  return await test(args)
    .then(() => ({ pass: true, error: undefined }) as const)
    .catch((error: Error) => ({ pass: false, error }) as const)
    .then(async (x) => {
      const id = args.getFightId();
      useAutomaticTimer();
      if (id === undefined) return x;

      // finish the game properly before deleting
      args.getFight().lobby.endGame("test_user_1", "test_user_2");
      await args.getFight().gameDone;
      await cleanupLeftovers({
        fightIds: [id],
      });
      return x;
    })
    .then(({ pass, error }) => {
      if (!pass) {
        throw error;
      }
    });
}

async function setupTest() {
  const callers = await getTestUserCallers();

  const firstListener = vi.fn<[BaseGamePlayerEvents], void>();
  const secondListener = vi.fn<[BaseGamePlayerEvents], void>();
  const firstRpsListener = vi.fn<[RockPaperScissorsPlayerEvents], void>();
  const secondRpsListener = vi.fn<[RockPaperScissorsPlayerEvents], void>();
  lobbyHandler.defineNextGameType("rock-paper-scissors");

  const { id: fightId } = await callers.test_user_1.lobby.create({
    opponent: `test_user_2`,
  });

  await callers.test_user_1.lobby.join();
  await callers.test_user_2.lobby.join();

  const state = {
    fightId,
    fight: lobbyHandler.getFight(fightId) as RockPaperScissorsGameInstance,
    test_user_1: {
      base: (
        await callers.test_user_1.lobby.onGameAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstListener(event) }),
      rps: (
        await callers.test_user_1.rockPaperScissors.onAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstRpsListener(event) }),
    },
    test_user_2: {
      base: (
        await callers.test_user_2.lobby.onGameAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondListener(event) }),
      rps: (
        await callers.test_user_2.rockPaperScissors.onAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondRpsListener(event) }),
    },
  };

  const choose = async (
    player: "test_user_1" | "test_user_2",
    choice: "rock" | "paper" | "scissors",
  ) => {
    await runAllMacroTasks();
    await callers[player].rockPaperScissors.choose(choice);
    await runAllMacroTasks();
  };

  const startGame = async () => {
    await callers.test_user_1.lobby.ready();
    await callers.test_user_2.lobby.ready();
    await runAllMacroTasks();
    await runAllMacroTasks();
  };

  return {
    callers,
    getFightId: () => state.fightId,
    getGame: () => state.fight.game,
    getFight: () => state.fight,
    startGame,
    choose,
    firstListener,
    firstRpsListener,
    secondListener,
    secondRpsListener,
    timer: getManualTimer(),
  };
}
