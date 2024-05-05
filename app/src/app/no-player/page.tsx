import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function NoPlayerPage() {
  return (
    <div className="flex h-full flex-row items-center px-4">
      <div>
        <Card>
          <CardHeader>
            <CardTitle>No Player</CardTitle>
            <CardDescription>
              You are not a player and do not have access to the game features.
              Please contact the game administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
