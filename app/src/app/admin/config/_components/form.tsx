"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

type GameConfig = RouterOutputs["gameConfig"]["currentConfig"];

export function ConfigForm({ params }: { params: GameConfig }) {
  const [enabledGame, setEnabledGame] = useState(params.enableGame);
  const [hasChange, setHasChange] = useState(false);
  const router = useRouter();

  const changeSetting = api.gameConfig.setConfigValue.useMutation({
    onSuccess() {
      toast({
        title: "Game state updated",
      });
      router.refresh();
    },
    onError(error) {
      toast({
        title: "Error changing game state",
        variant: "destructive",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    setHasChange(params.enableGame !== enabledGame);
  }, [params.enableGame, enabledGame, setHasChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Game Config</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled-game"
              checked={enabledGame}
              onCheckedChange={setEnabledGame}
            />
            <Label htmlFor="enabled-game" className="text-right">
              Game Enabled
            </Label>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          disabled={!hasChange}
          onClick={() =>
            changeSetting.mutate({
              name: "enableGame",
              value: enabledGame,
            })
          }
        >
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}
