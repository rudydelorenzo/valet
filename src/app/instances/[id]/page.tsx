import { Suspense } from "react";
import InstanceDetailContent from "./content";

export const instant = false;

const InstanceDetailPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <InstanceDetailContent params={params} />
    </Suspense>
  );
};

export default InstanceDetailPage;