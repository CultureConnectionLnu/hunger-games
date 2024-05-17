"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import Image from "next/image";
import bigMap from "./_assets/big-map.jpg";
import smallMap from "./_assets/small-map.jpg";
import rockPaperScissors from "./_assets/rock-paper-scissors.png";
import orderedMemory from "./_assets/ordered-memory.png";
import typing from "./_assets/typing.png";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

type ListingParams = Record<
  string,
  { title: string; description: React.ReactNode }
>;

const imageSizeConfig: "small" | "big" = "small";

export default function RulesPage() {
  const [tab, setTab] = useState("physical");
  return (
    <main className="p-4">
      <h1 className="text-center text-2xl font-semibold leading-none tracking-tight">
        Rules
      </h1>
      <Listing
        params={{
          times: {
            title: "Times",
            description: <TimesDetail />,
          },
        }}
      />
      <Image src={imageSizeConfig === "small" ? smallMap : bigMap} alt="Map" />
      <Listing
        params={{
          "map-details": {
            title: "Map Details",
            description: <MapDetails />,
          },
          hubs: {
            title: "Hubs",
            description: <HubDetails />,
          },
        }}
      />
      <Tabs value={tab} onValueChange={setTab} className="h-full pt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="physical">Physical</TabsTrigger>
          <TabsTrigger value="app">App</TabsTrigger>
        </TabsList>
        <TabsContent value="physical" className="rounded-sm bg-muted px-4">
          <Listing
            params={{
              "catch-players": {
                title: "Catch Players",
                description: <CatchPlayerDetails />,
              },
              "physical-quests": {
                title: "Quests",
                description: <PhysicalQuestDetails />,
              },
            }}
          />
        </TabsContent>
        <TabsContent value="app" className="rounded-sm bg-muted px-4">
          <Listing
            params={{
              "rock-paper-scissors": {
                title: "Rock Paper Scissors",
                description: <RockPaperScissorsDetails />,
              },
              "ordered-memory": {
                title: "Ordered Memory",
                description: <OrderedMemoryDetails />,
              },
              typing: {
                title: "Typing",
                description: <TypingDetails />,
              },
              "app-quests": {
                title: "Quests",
                description: <AppQuestDetails />,
              },
            }}
          />
        </TabsContent>
      </Tabs>
      <Listing
        params={{
          scoring: {
            title: "Scoring",
            description: <ScoringDetails />,
          },
          wounded: {
            title: "Wounded",
            description: <WoundedDetails />,
          },
        }}
      />
    </main>
  );
}

function TimesDetail() {
  return (
    <div>
      <p>
        The game is played in real-time. The game starts at 12:00 and ends at
        16:00.
      </p>
    </div>
  );
}

function MapDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Map Distribution: </span>
        Provide each player with a digital map showing the boundaries and key
        locations through the app.
      </p>
      <p>
        <span className="font-bold">Boundaries: </span>
        Players must hide within the defined boundaries but can temporarily
        enter outside boundaries if being chased. Returning to the game area
        promptly is required.
      </p>
    </div>
  );
}

function HubDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Map Distribution: </span>
        Provide each player with a digital map showing the boundaries and key
        locations through the app.
      </p>
      <p>
        <span className="font-bold">Boundaries: </span>
        Players must hide within the defined boundaries but can temporarily
        enter outside boundaries if being chased. Returning to the game area
        promptly is required.
      </p>
    </div>
  );
}

function CatchPlayerDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Caught Players: </span>Tagged players are
        considered active in the game by scanning a unique QR code and being
        directed to a mini-game. The loser of the mini-game is considered
        injured.
      </p>
    </div>
  );
}

function PhysicalQuestDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Quests: </span>Quests are available to all
        players and involve reaching certain locations on the map (hubs).
      </p>
      <p>
        <span className="font-bold">Quest Points: </span>Assign points to each
        quest. Players earn points for completing quests. If a player is tagged
        during a quest and loses the mini-game, the quest gets canceled.
      </p>
      <p>
        <span className="font-bold">Quest Locations (Hubs): </span>Mark key
        locations on the map where quests can be given and completed. These hubs
        are not safe zones.
      </p>
    </div>
  );
}

function RockPaperScissorsDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Rock-Paper-Scissors: </span>Classic game
        where rock beats scissors, scissors beat paper, and paper beats rock.
      </p>
      <Image src={rockPaperScissors} alt="Rock Paper Scissors Game" />
    </div>
  );
}

function OrderedMemoryDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Memory Game: </span>Players need to press
        lighted boxes in a numbered sequence.
      </p>
      <Image src={orderedMemory} alt="Ordered Memory Game" />
    </div>
  );
}

function TypingDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Fast Typer: </span>Players must type a given
        text as fast as possible. Each mistake removes one-second to their time.
      </p>
      <Image src={typing} alt="Typing Game" />
    </div>
  );
}

function AppQuestDetails() {
  return (
    <div>
      <p>
        This quest can be assigned in one of the hubs, and the moderator of the
        hub can give you a choice of how many hubs you need to visit.
      </p>
      <p className="font-bold">Levels:</p>
      <p>
        <span className="font-bold">Easy: </span>visit only one hub.
      </p>
      <p>
        <span className="font-bold">Medium: </span>visit two hubs.
      </p>
      <p>
        <span className="font-bold">Hard: </span>rush to three different hubs.
      </p>
    </div>
  );
}

function ScoringDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Score Tracking: </span>The app tracks
        scores. Points are awarded for completing quests and by winning
        (injuring) against other players.
      </p>
      <p>
        <span className="font-bold">Bonus Points: </span>Extra points are
        awarded to players who never (died) in the game or had the most quest
        completions and mini-game wins.
      </p>
      <p>
        <span className="font-bold">Point Transfer: </span>When a player loses a
        mini-game against another player, the loser loses 50% of their points,
        and the winner gains those points.
      </p>
    </div>
  );
}

function WoundedDetails() {
  return (
    <div>
      <p>
        <span className="font-bold">Injury and Hospital: </span>If a player is
        tagged and loses the mini-game, they are considered injured and must go
        to the main hospital to revive.
      </p>
      <p>
        <span className="font-bold">Revival/Healing: </span>At the main
        hospital, injured players can revive by a doctor (moderator) by scanning
        the player unique QR code. The player must wait 2 minutes and then
        return to the doctor to sign out.
      </p>
    </div>
  );
}

function Listing({ params }: { params: ListingParams }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {Object.entries(params).map(([key, { description, title }]) => (
        <AccordionItem key={key} value={key}>
          <AccordionTrigger>{title}</AccordionTrigger>
          <AccordionContent>{description}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
