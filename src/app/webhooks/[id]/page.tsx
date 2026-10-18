import { Suspense } from "react";
import WebhookDetailContent from "./content";

export const instant = false;

const WebhookDetailPage = ({
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
      <WebhookDetailContent params={params} />
    </Suspense>
  );
};

export default WebhookDetailPage;