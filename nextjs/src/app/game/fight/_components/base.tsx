import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function GameCard({
  header,
  children,
  footer,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-center space-x-4">
        {header}
      </CardHeader>
      {children !== undefined ? (
        <CardContent className="flex flex-col items-center justify-center p-8 pt-0">
          {children}
        </CardContent>
      ) : (
        <></>
      )}
      {footer !== undefined ? (
        <CardFooter className="flex items-center justify-center p-8 pt-0">
          {footer}
        </CardFooter>
      ) : (
        <></>
      )}
    </Card>
  );
}

export function GameContentLoading() {
  return (
    <GameCard header={<Skeleton className="h-8 w-3/4" />}>
      <div className="space-y-4 text-center">
        <Skeleton className="h-4 w-[300px]" />
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </GameCard>
  );
}
