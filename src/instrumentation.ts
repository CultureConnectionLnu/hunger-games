import { isNull } from "drizzle-orm";
import { db } from "./server/db";
import { fight } from "./server/db/schema";

export function register() {
    console.log('startup done')
  void removeNotFinishedFights().then((x) => {
    if (x.count === 0) return;

    console.log(
      "Deleted dangling fights upon startup of server. count: ",
      x.count,
    );
  });
}

async function removeNotFinishedFights() {
  return db.delete(fight).where(isNull(fight.winner));
}
