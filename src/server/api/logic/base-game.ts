import { GenericEventEmitter } from "~/lib/event-emitter";

export type BaseGameEvents = {
  joined: {
    otherPlayers: string[];
    startTimeUnix: number;
    startTimeoutInSeconds: number;
    view: "ready";
  };
  opponentJoined: {
    joined: string;
    view: "ready" | "waiting";
  };
  allJoined: {
    view: "ready" | "waiting";
  };
  readied: {
    view: "waiting";
  };
  opponentReadied: {
    view: "ready" | "waiting";
  };
  allReady: {
    view: "start";
  };
  end: {
    view: "won" | "lost";
    winner: string;
  };
};

type ToGameEvent<Events, T> = T extends keyof Events
  ? {
      event: T;
      data: Events[T];
      fightId: string;
    }
  : never;
type AnyGameEvent<T> = ToGameEvent<T, keyof T>;
type ThisEvents<T> = T extends BaseGame<infer R> ? R & BaseGameEvents : never;

type PlayerId = string;
type GameState<SpecificGameViews extends string> = {
  server: {
    state: string;
    joinedPlayers: string[];
  };
  players: Record<string, PlayerState<SpecificGameViews> | undefined>;
};

type PlayerState<SpecificGameViews extends string = never> = {
  currentView:
    | BaseGameEvents[keyof BaseGameEvents]["view"]
    | "none"
    | SpecificGameViews;
  id: string;
};

type PlayerViews<SpecificGameViews extends string> =
  PlayerState<SpecificGameViews>["currentView"];

export abstract class BaseGame<
  SpecificGameEvents extends Record<string, unknown>,
  SpecificGameViews extends string = never,
> extends GenericEventEmitter<{
  [player: `player-${PlayerId}`]: AnyGameEvent<
    SpecificGameEvents & BaseGameEvents
  >;
  // emitted upon game end
  end: void;
  // emitted upon game destruction
  destroy: void;
}> {
  private events: AnyGameEvent<ThisEvents<this>>[] = [];
  protected baseState: GameState<SpecificGameViews>;

  constructor(
    public readonly fightId: string,
    public readonly players: string[],
  ) {
    super();
    this.baseState = {
      server: {
        state: "init",
        joinedPlayers: [],
      },
      players: players.reduce<Record<string, PlayerState>>((acc, val) => {
        acc[val] = {
          currentView: "none",
          id: val,
        };
        return acc;
      }, {}),
    };
  }

  abstract destroy(): void;

  // todo: find a way to get rid of any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private emitPlayerEvent(player: PlayerId | PlayerId[], event: any) {
    if (Array.isArray(player)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      player.forEach((p) => this.emit(`player-${p}`, event));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.emit(`player-${player}`, event);
    }
  }

  /**
   * if `player` is not present, then it is emitted to all players
   * @param event 
   * @param data 
   * @param player 
   * @returns 
   */
  protected emitGameEvent<const T extends keyof ThisEvents<this>>(
    event: T,
    data: ThisEvents<this>[T],
    player?: PlayerId,
  ) {
    const extendedEvent = {
      state: event,
      data,
      fightId: this.fightId,
    } as unknown as ToGameEvent<ThisEvents<this>, T>;

    this.events.push(extendedEvent);
    if (event === "end") {
      this.emitPlayerEvent(this.players, extendedEvent);
      this.emit("end", undefined);
      return;
    }

    this.emitPlayerEvent(player ?? this.players, extendedEvent);
  }

  playerJoin(playerId: string) {
    this.assertPlayerView(playerId, ["none"]);
    const player = this.assertPlayerExists(playerId, this.baseState.players)
    player.currentView = 'ready';
    this.checkPlayerView('ready', {
      onAll: ()=>{
        this.emitGameEvent('allJoined', {
          view: 'ready'
        })
      },
      onSome: ()=>{
        this.emitGameEvent('joined', {
          
        })
      }
    })
  }

  protected assertPlayerExists<T>(
    playerId: string,
    state: Record<string, T | undefined>,
  ) {
    const playerState = state[playerId];
    if (!playerState) {
      throw new Error(
        "Player that is not part of the game tried to ready " + playerId,
      );
    }
    return playerState;
  }

  protected assertPlayerView(
    playerId: string,
    allowedStates: PlayerViews<SpecificGameViews>[],
  ) {
    const playerState = this.baseState.players[playerId];
    if (!playerState) {
      throw new Error(
        "Player that is not part of the game tried to ready " + playerId,
      );
    }
    if (!allowedStates.includes(playerState.currentView)) {
      throw new Error(
        `player tried to make a move when they are not in the correct state. Current state '${playerState.currentView}' allowed states '${allowedStates.join(",")}'. Player: ${playerState.id}`,
      );
    }
  }

  /**
   * Only executes one of the two functions.
   * prioritizes execution of `onAll`.
   * @param view 
   * @param param1 
   * @returns 
   */
  protected checkPlayerView(
    view: PlayerViews<SpecificGameViews>,
    {
      onAll,
      onSome,
    }: {
      onAll?: () => void;
      onSome?: () => void;
    },
  ) {
    if (onAll) {
      const all = Object.values(this.baseState.players).every(
        (playerState) => playerState?.currentView === view,
      );
      if (all) {
        onAll();
        return;
      }
    }
    if (onSome) {
      const some = Object.values(this.baseState.players).some(
        (playerState) => playerState?.currentView === view,
      );
      if (some) {
        onSome();
      }
    }
  }
}
