import { FindWounded } from "./_components/find-wounded";
import { WoundedPlayerDialog } from "./_components/wounded-dialog";
import { WoundedTable } from "./_components/wounded-table";

export default async function MedicOverview() {
  return (
    <div className="flex h-full flex-col gap-4 pb-4">
      <WoundedTable />
      <WoundedPlayerDialog />
      <div className="flex flex-row-reverse px-4">
        <FindWounded />
      </div>
    </div>
  );
}
