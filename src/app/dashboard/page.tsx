"use client";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type ScoreBoardEntry = UnwrapArray<RouterOutputs["score"]["dashboard"]>;

export default function Dashboard() {
  const { isLoading, data } = api.score.dashboard.useQuery();

  if (isLoading) {
    return <DashboardLoading />;
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <section>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((entry) => (
              <DashboardEntry key={entry.userId} {...entry} />
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function DashboardLoading() {
  return "skeleton";
}

function DashboardEntry({ rank, score, userId }: ScoreBoardEntry) {
  const { isLoading, data: userName } = api.user.getUserName.useQuery(
    { id: userId },
    {
      staleTime: Infinity,
    },
  );

  if (isLoading) {
    return <tr>skeleton</tr>;
  }

  return (
    <tr>
      <td>{rank}</td>
      <td>{userName}</td>
      <td>{score}</td>
    </tr>
  );
}
