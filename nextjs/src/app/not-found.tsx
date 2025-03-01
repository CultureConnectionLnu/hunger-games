import Link from "next/link";
import { MdHome } from "react-icons/md";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function NotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>404</CardTitle>
        <CardDescription>Page not found</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start">
            <MdHome className="mr-2 h-4 w-4" />
            Back to landing page
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
