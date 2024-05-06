import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function NoQuest() {
  return (
    <div className="flex h-full flex-col justify-center px-4">
      <Card>
        <CardHeader>
          <CardTitle>No active Quest</CardTitle>
          <CardDescription>
            To start a new quest, visit one of the hubs.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
