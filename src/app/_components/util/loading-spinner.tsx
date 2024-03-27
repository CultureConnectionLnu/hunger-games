"use client";

import { FaSpinner } from "react-icons/fa";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function LoadingScreen({
  params,
}: {
  params: { title: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{params.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <FaSpinner className="animate-spin" />
      </CardContent>
    </Card>
  );
}
