/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it, vi } from "vitest";
import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game";
import { type GetTimerEvents } from "~/server/api/logic/core/types";
import {
  type TypingPlayerState,
  type TypingEvents,
} from "~/server/api/logic/games/typing";
import { lobbyHandler, type TypingGame } from "~/server/api/logic/handler";
import { type TypingPlayerEvents } from "~/server/api/routers/games/typing";
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
import { fail } from "assert";

export const typingTests = () =>
  describe("Seed Typing", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    describe("Evaluation", () => {
      it("should be a draw no one types anything", () =>
        testFight(async ({ startGame, timeoutTimer, expectDraw }) => {
          await startGame();

          await timeoutTimer("typing-timer");

          await expectDraw();
        }));

      it("should be a draw if both type in the same amount of seconds and without mistakes", () =>
        testFight(
          async ({ startGame, sendCurrentText, timeoutTimer, expectDraw }) => {
            await startGame("Test Text");

            await sendCurrentText("test_user_1", "T");
            await sendCurrentText("test_user_2", "T");
            await timeoutTimer("typing-timer");

            await expectDraw();
          },
        ));

      it("player 1 should win when only he typed something at all", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            sendCurrentText,
            expectGameEnded,
          }) => {
            await startGame("Test Text");

            await sendCurrentText("test_user_1", "T");
            await timeoutTimer("typing-timer");

            await expectGameEnded("test_user_1");
          },
        ));

      it("player 2 should win when only he typed something at all", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            sendCurrentText,
            expectGameEnded,
          }) => {
            await startGame("Test Text");

            await sendCurrentText("test_user_2", "T");
            await timeoutTimer("typing-timer");

            await expectGameEnded("test_user_2");
          },
        ));

      it("should be draw if both enter correct pattern", () =>
        testFight(async ({ startGame, sendCurrentText, expectDraw }) => {
          const text = "Test Text";
          await startGame(text);

          await sendCurrentText("test_user_1", text);
          await sendCurrentText("test_user_2", text);

          await expectDraw();
        }));

      it("player 1 should win as he made less mistakes in same time", () =>
        testFight(async ({ startGame, sendCurrentText, expectGameEnded }) => {
          const text = "Test Text";
          await startGame(text);

          await sendCurrentText("test_user_1", text);
          await sendCurrentText("test_user_2", "Test Tex_");

          await expectGameEnded("test_user_1");
        }));

      it("player 2 should win as he made less mistakes in same time", () =>
        testFight(async ({ startGame, sendCurrentText, expectGameEnded }) => {
          const text = "Test Text";
          await startGame(text);

          await sendCurrentText("test_user_2", text);
          await sendCurrentText("test_user_1", "Test Tex_");

          await expectGameEnded("test_user_2");
        }));
    });

    describe("Text validation", () => {
      it("should find no mistakes in partial text", () =>
        testFight(async ({ startGame, sendCurrentText, expectPlayerState }) => {
          await startGame("Test Text");
          await sendCurrentText("test_user_1", "Test");

          expectPlayerState("test_user_1", {
            mistakes: 0,
          });
        }));

      it("should find mistakes in partial text", () =>
        testFight(async ({ startGame, sendCurrentText, expectPlayerState }) => {
          await startGame("Test Text");
          await sendCurrentText("test_user_1", "T_s_");

          expectPlayerState("test_user_1", {
            mistakes: 2,
          });
        }));

      it("should find no mistakes in full text", () =>
        testFight(async ({ startGame, sendCurrentText, expectPlayerState }) => {
          await startGame("Test Text");
          await sendCurrentText("test_user_1", "Test Text");

          expectPlayerState("test_user_1", {
            mistakes: 0,
          });
        }));

      it("should find mistakes in full text", () =>
        testFight(async ({ startGame, sendCurrentText, expectPlayerState }) => {
          await startGame("Test Text");
          await sendCurrentText("test_user_1", "T_s_ Text");

          expectPlayerState("test_user_1", {
            mistakes: 2,
          });
        }));
    });

    describe("Views", () => {
      it("after game start, should show 'enable-typing' view", () =>
        testFight(
          async ({ startGame, firstTypingListener, secondTypingListener }) => {
            await startGame();

            expect(
              getLastEventOf(firstTypingListener, "provide-text")?.view,
            ).toEqual("enable-typing");
            expect(
              getLastEventOf(secondTypingListener, "provide-text")?.view,
            ).toEqual("enable-typing");
          },
        ));

      it("should switch to 'waiting-for-opponent' once completed writing", () =>
        testFight(
          async ({ startGame, sendCurrentText, firstTypingListener }) => {
            await startGame("Test Text");
            await sendCurrentText("test_user_1", "Test Text");

            expect(
              getLastEventOf(firstTypingListener, "show-waiting")?.view,
            ).toEqual("waiting-for-opponent");
          },
        ));

      it('should switch to "show-result" if both players entered the full text', () =>
        testFight(
          async ({ startGame, sendCurrentText, firstTypingListener }) => {
            await startGame("Test Text");
            await sendCurrentText("test_user_1", "Test Text");
            await sendCurrentText("test_user_2", "Test Text");

            expect(
              getLastEventOf(firstTypingListener, "show-result")?.view,
            ).toEqual("show-result");
          },
        ));

      it('should switch to "show-result" if no one enters anything', () =>
        testFight(async ({ startGame, timeoutTimer, firstTypingListener }) => {
          await startGame("Test Text");
          await timeoutTimer("typing-timer");

          expect(
            getLastEventOf(firstTypingListener, "show-result")?.view,
          ).toEqual("show-result");
        }));
    });

    describe("Timers", () => {
      it("should start typing timer", () =>
        testFight(async ({ startGame, expectRunningTimer }) => {
          await startGame();
          expectRunningTimer("typing-timer");
        }));

      it("should show next round timer in case of draw", () =>
        testFight(async ({ startGame, timeoutTimer, expectRunningTimer }) => {
          await startGame();
          await timeoutTimer("typing-timer");

          expectRunningTimer("next-round-timer");
        }));

      it("should not show next round timer, if the game is over", () =>
        testFight(
          async ({ startGame, sendCurrentText, expectNotRunningTimer }) => {
            await startGame("Test Text");

            await sendCurrentText("test_user_1", "Test Text");

            expectNotRunningTimer("next-round-timer");
          },
        ));

      it("should start typing timer again after next round timer", () =>
        testFight(async ({ startGame, timeoutTimer, expectRunningTimer }) => {
          await startGame();

          await timeoutTimer("typing-timer");
          await timeoutTimer("next-round-timer");

          expectRunningTimer("typing-timer");
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
  const firstTypingListener = vi.fn<[TypingPlayerEvents], void>();
  const secondTypingListener = vi.fn<[TypingPlayerEvents], void>();
  lobbyHandler.defineNextGameType("typing");

  const { id: fightId } = await callers.test_user_1.lobby.create({
    opponent: `test_user_2`,
  });

  await callers.test_user_1.lobby.join();
  await callers.test_user_2.lobby.join();

  const state = {
    fightId,
    fight: lobbyHandler.getFight(fightId) as TypingGame,
    test_user_1: {
      base: (
        await callers.test_user_1.lobby.onGameAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstListener(event) }),
      rps: (
        await callers.test_user_1.typing.onAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstTypingListener(event) }),
    },
    test_user_2: {
      base: (
        await callers.test_user_2.lobby.onGameAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondListener(event) }),
      rps: (
        await callers.test_user_2.typing.onAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondTypingListener(event) }),
    },
  };

  const startGame = async (fixedText?: string) => {
    if (fixedText) state.fight.game.useFixedText(fixedText);
    await callers.test_user_1.lobby.ready();
    await callers.test_user_2.lobby.ready();
    await runAllMacroTasks();
    await runAllMacroTasks();
  };

  const sendCurrentText = async (
    player: `test_user_${1 | 2}`,
    text: string,
  ) => {
    await callers[player].typing.reportStatus({ text });
  };

  const timer = getManualTimer();
  type KnownTimers = GetTimerEvents<TypingEvents>;

  return {
    getFightId: () => state.fightId,
    getGame: () => state.fight.game,
    getFight: () => state.fight,
    startGame,
    sendCurrentText,
    firstTypingListener,
    secondTypingListener,
    expectGameEnded: async (winnerId: `test_user_${1 | 2}`) => {
      expectEventEmitted(firstListener, "game-ended");
      const event = getLastEventOf(firstListener, "game-ended");
      expect(event?.data).toEqual({
        winnerId,
        loserId: winnerId === "test_user_1" ? "test_user_2" : "test_user_1",
      });
    },
    expectDraw: async () => {
      expectEventEmitted(firstTypingListener, "show-result");
      const event = getLastEventOf(firstTypingListener, "show-result");
      expect(event?.data).toEqual({
        outcome: "draw",
        yourName: "Test User 1",
        opponentName: "Test User 2",
      });
    },
    expectPlayerState: (
      playerId: `test_user_${1 | 2}`,
      playerState: Partial<TypingPlayerState>,
    ) => {
      const player = state.fight.game.getPlayer(playerId);
      if (!player) {
        fail("Player not found");
        return;
      }
      expect(player.states).toMatchObject(playerState);
    },
    expectRunningTimer: (name: KnownTimers) => {
      expect(() => timer.getLastRunningByName(name)).not.toThrow();
      expect(
        getLastEventOf(firstTypingListener, name)?.data.secondsLeft,
      ).toBeGreaterThan(0);
    },
    expectNotRunningTimer: (name: KnownTimers) => {
      expect(() => timer.getLastRunningByName(name)).toThrow();
    },
    timeoutTimer: async (name: KnownTimers) => {
      timer.getLastRunningByName(name).emitTimeout();
      await runAllMacroTasks();
    },
  };
}
