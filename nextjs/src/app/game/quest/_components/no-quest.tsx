import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function NoQuest() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No active Quest</CardTitle>
        <CardDescription>
          To start a new quest, visit one of the hubs.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
