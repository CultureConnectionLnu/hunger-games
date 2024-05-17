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
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card } from "~/components/ui/card";

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
        The game is played in real-time. The game starts at 10:00 and ends at
        16:00.
      </p>
    </div>
  );
}

function MapDetails() {
  return (
    <div>
      <p>
        The map is divided into 5 areas: the hub, the forest, the mountains, the
        river, and the village.
      </p>
      <p>
        Each area has its own unique challenges and quests. The hub is the
        starting point of the game.
      </p>
    </div>
  );
}

function HubDetails() {
  return (
    <div>
      <p>
        The hub is the starting point of the game. Players can find quests and
        challenges here.
      </p>
      <p>
        The hub is also the place where players can meet and interact with each
        other.
      </p>
    </div>
  );
}

function CatchPlayerDetails() {
  return (
    <div>
      <p>
        Players can catch other players by tagging them. When a player is
        caught, they must go to the hub to be released.
      </p>
    </div>
  );
}

function PhysicalQuestDetails() {
  return (
    <div>
      <p>
        Physical quests are quests that require players to complete physical
        challenges.
      </p>
    </div>
  );
}

function RockPaperScissorsDetails() {
  return (
    <div>
      <p>
        Players can play rock paper scissors to decide the outcome of a
        challenge.
      </p>
    </div>
  );
}

function OrderedMemoryDetails() {
  return (
    <div>
      <p>
        Players must remember a sequence of numbers and repeat it back in the
        correct order.
      </p>
    </div>
  );
}

function TypingDetails() {
  return (
    <div>
      <p>Players must type a given word within a time limit.</p>
    </div>
  );
}

function AppQuestDetails() {
  return (
    <div>
      <p>Quests that require the use of the app.</p>
    </div>
  );
}

function ScoringDetails() {
  return (
    <div>
      <p>
        Players earn points by completing quests and challenges. The player with
        the most points at the end of the game wins.
      </p>
    </div>
  );
}

function WoundedDetails() {
  return (
    <div>
      <p>Players can revive other players by tagging them.</p>
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
