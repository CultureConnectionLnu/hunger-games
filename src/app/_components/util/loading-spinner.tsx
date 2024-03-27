"use client";

import { FaSpinner } from "react-icons/fa";

export default function LoadingScreen({
  params,
}: {
  params: { title: string };
}) {
  return (
    <p>
      {params.title}
      <FaSpinner className="animate-spin" />
    </p>
  );
}
