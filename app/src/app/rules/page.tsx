"use client";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
// @ts-expect-error ci is complaining
import map from "./_assets/map.png";
// @ts-expect-error ci is complaining
import rockPaperScissors from "./_assets/rock-paper-scissors.png";
// @ts-expect-error ci is complaining
import orderedMemory from "./_assets/ordered-memory.png";
// @ts-expect-error ci is complaining
import typing from "./_assets/typing.png";
// @ts-expect-error ci is complaining
import gameDisabled from "./_assets/game-disabled.png";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  orderedMemoryConfig,
  rockPaperScissorsConfig,
  typingConfig,
} from "~/server/api/logic/config";

export default function RulesPage() {
  const [tab, setTab] = useState("physical");
  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 pb-8">
      <h1 className="pb-4 text-center text-2xl font-semibold leading-none tracking-tight">
        Rules
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Image src={map} alt="Map" className="mx-auto rounded-lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TimesDetail />
          <Separator />
          <MapDetails />
          <Separator />
          <HubDetails />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game Play</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="physical">Physical</TabsTrigger>
              <TabsTrigger value="app">App</TabsTrigger>
            </TabsList>
            <TabsContent value="physical" className="mt-4 space-y-6">
              <CatchPlayerDetails />
              <Separator />
              <QuestAtHubDetails />
            </TabsContent>
            <TabsContent value="app" className="mt-4 space-y-6">
              <RockPaperScissorsDetails />
              <Separator />
              <OrderedMemoryDetails />
              <Separator />
              <TypingDetails />
              <Separator />
              <WalkingQuestDetails />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game Mechanics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoringDetails />
          <Separator />
          <WoundedDetails />
        </CardContent>
      </Card>
    </main>
  );
}

function TimesDetail() {
  return (
    <div>
      <SectionTitle>Times</SectionTitle>
      <SectionContent>
        <Text>
          The game is played by <BoldText>Swedish time (GMT+2).</BoldText>
        </Text>
        <Text>All events start at 12:00 and end at 17:00.</Text>
        <Text>The event will contain 2 rounds of the game, possibly 3.</Text>
        <Text>
          One round will take <BoldText>45 minutes</BoldText> from its start.
        </Text>
        <Text>
          Before the game starts and once the time runs out, you will see the
          following error when starting a fight or trying to get a quest:
          <Image
            src={gameDisabled}
            alt="Game Disabled"
            className="mt-2 rounded-lg"
          />
          When you see this, please come back to the start area.
        </Text>
      </SectionContent>
    </div>
  );
}

function MapDetails() {
  return (
    <div>
      <SectionTitle>Map Distribution</SectionTitle>
      <SectionContent>
        <Text>
          Provide each player with a digital map showing the boundaries and key
          locations through the app.
        </Text>
        <Text>
          <BoldText>Boundaries: </BoldText>
          Players must hide within the defined boundaries, but can temporarily
          enter outside boundaries if being chased. Returning to the game area
          promptly is required.
        </Text>
      </SectionContent>
    </div>
  );
}

function HubDetails() {
  return (
    <div>
      <SectionTitle>Hub</SectionTitle>
      <SectionContent>
        <Text>
          Hubs are areas where a moderator is located. You can play a mini game
          or get a walking quest there.
        </Text>
        <Text>
          The hubs are distributed over the campus. There are{" "}
          <BoldText>6</BoldText> hubs and you have to find them yourself. When
          you do walking quest, then you will get a description of the
          destination hub locations. More information about walking quests in
          the <BoldText>App</BoldText> section under &quot;Game Play&quot;.
        </Text>
        <Text>
          <BoldText>Safe zone: </BoldText>
          If a player is with a hub moderator or in line, then you can&apos;t
          attack them. The hub moderator can in this case tell other players
          that they can&apos;t attack you.
        </Text>
      </SectionContent>
    </div>
  );
}

function CatchPlayerDetails() {
  return (
    <div>
      <SectionTitle>Fighting other Players</SectionTitle>
      <SectionContent>
        <Text>
          In order to fight another player, you need to catch/tag them with a
          full hand. Once you catch/tag someone or get caught, then one of you
          has to scan the others QR code in order to start one of the games in
          the app.
        </Text>
        <Text>
          <BoldText>Winner:</BoldText> steals points from the loser.
        </Text>
        <Text>
          <BoldText>Loser:</BoldText> loses points, becomes wounded and looses
          any active quest (walking quest).
        </Text>
      </SectionContent>
    </div>
  );
}

function QuestAtHubDetails() {
  return (
    <div>
      <SectionTitle>Quests at the Hub</SectionTitle>
      <SectionContent>
        <Text>
          The quests at the hub are mini games that you need to complete at the
          hub. The hub moderator will inform you about what mini game is
          available at his/her hub.
        </Text>
        <Text>
          <BoldText>Quest Points: </BoldText>
          You get points for completing the quest. How many points depends on
          the game you are playing at the hub. Ask the hub moderator for more
          information.
        </Text>
      </SectionContent>
    </div>
  );
}

function RockPaperScissorsDetails() {
  return (
    <div>
      <SectionTitle>Rock-Paper-Scissors</SectionTitle>
      <SectionContent>
        <Text>
          Classic game where rock beats scissors, scissors beat paper, and paper
          beats rock.
        </Text>
        <Text>
          <BoldText>Winning condition:</BoldText> Best of{" "}
          {rockPaperScissorsConfig.bestOf}.
        </Text>
        <Text>
          The game will not end in a draw. It will continue until one player
          wins the best of {rockPaperScissorsConfig.bestOf} rounds.
        </Text>
        <Image
          src={rockPaperScissors}
          alt="Rock Paper Scissors Game"
          className="mx-auto rounded-lg"
        />
      </SectionContent>
    </div>
  );
}

function OrderedMemoryDetails() {
  return (
    <div>
      <SectionTitle>Memory Game</SectionTitle>
      <SectionContent>
        <Text>
          You will shortly ({orderedMemoryConfig.showPatternTimeoutInSeconds}{" "}
          seconds) see a pattern with numbers. Remember the pattern and press
          the boxes in the correct order. You only have{" "}
          {orderedMemoryConfig.inputPatternTimeoutInSeconds} seconds to repeat
          the correct order.
        </Text>
        <Text>
          <BoldText>Winning condition:</BoldText> The player that progresses
          further in the game until failure wins.
        </Text>
        <Text>
          If both players fail in the same round, the game will restart this
          round until one player is the clear winner.
        </Text>
        <Image
          src={orderedMemory}
          alt="Ordered Memory Game"
          className="mx-auto rounded-lg"
        />
      </SectionContent>
    </div>
  );
}

function TypingDetails() {
  return (
    <div>
      <SectionTitle>Fast Typer</SectionTitle>
      <SectionContent>
        <Text>
          Type the shown text on your phone as fast as possible. But be careful,
          each mistake will add {typingConfig.timePenaltyPerMistakeInSeconds}{" "}
          second to your total time. You only have up to{" "}
          {typingConfig.writingTimeInSeconds} seconds to write the text.
        </Text>
        <Text>
          <BoldText>Winning condition:</BoldText> The player that took the least
          time.
        </Text>
        <Text>
          <BoldText>Score calculation:</BoldText> The score is calculated by the
          following formula:
          <pre>
            &quot;Seconds it took you to write the entire text&quot; + (mistakes
            * {typingConfig.timePenaltyPerMistakeInSeconds} seconds)
          </pre>
        </Text>
        <Text>
          If both players have the same score, then the game starts over with a
          new text.
        </Text>
        <Image src={typing} alt="Typing Game" className="mx-auto rounded-lg" />
      </SectionContent>
    </div>
  );
}

function WalkingQuestDetails() {
  return (
    <div>
      <SectionTitle>Walking Quests</SectionTitle>
      <SectionContent>
        <Text>
          The walking quests are about walking to other hubs and surviving. To
          start it, you need to visit a hub and request to do a walking quest.
          The moderator will scan your QR code and assign you one of three
          walking quests. Then you need to walk to the quest locations which are
          assigned randomly and show the other hub moderators your QR code to
          visit/complete it.
        </Text>
        <Text>
          <BoldText>Levels:</BoldText>
        </Text>
        <Text>
          <BoldText>Easy: </BoldText>
          visit only one hub. Point:<BoldText> 100</BoldText>
        </Text>
        <Text>
          <BoldText>Medium: </BoldText>
          visit two hubs. Point:<BoldText> 300</BoldText>
        </Text>
        <Text>
          <BoldText>Hard: </BoldText>
          visit three hubs. Point:<BoldText> 600</BoldText>
        </Text>
        <Text>
          If you are wounded while you have an active walking quest, then you
          will loose your progress of it.
        </Text>
      </SectionContent>
    </div>
  );
}

function ScoringDetails() {
  return (
    <div>
      <SectionTitle>Scoring</SectionTitle>
      <SectionContent>
        <Text>
          <BoldText>Score Tracking: </BoldText>The app tracks player scores.
          Points are awarded for completing quests and by winning fights against
          other players.
        </Text>
        <Text>
          <BoldText>Bonus Points: </BoldText>Extra points are awarded to players
          who never (died) in the game or had the most quest completions and
          mini-game wins.
        </Text>
        <Text>
          <BoldText>Point Transfer: </BoldText>TODO
        </Text>
      </SectionContent>
    </div>
  );
}

function WoundedDetails() {
  return (
    <div>
      <SectionTitle>Wounded State</SectionTitle>
      <SectionContent>
        <Text>
          If a player is tagged and loses the fight, they are considered wounded
          and must go to the start area where the medic is located.
        </Text>
        <Text>
          <BoldText>Healing: </BoldText>
          When you are wounded, then go to the start area and show your QR code
          to the medic. Once your code has been scanned your healing process
          starts. It takes 2 minutes to complete the healing. After the timer
          runs out, show your QR code once more to the medic to finish the
          healing precess. Now you are ready to continue playing the game.
        </Text>
      </SectionContent>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center text-lg font-semibold tracking-tight">
      {children}
    </h2>
  );
}

function SectionContent({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function Text({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function BoldText({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}
