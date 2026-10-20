import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";
import { CopyableContent } from "@/components/CopyableContent";

const SuccessStep = ({
  webhookName,
  token,
  onDone,
}: {
  webhookName: string;
  token: string;
  onDone: () => void;
}) => {
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/hooks/${token}`
      : `/api/hooks/${token}`;

  const curlExample = `curl -X POST ${webhookUrl}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{webhookName}</span> is
        ready. Send a POST request to the URL below to trigger a deployment hook.
      </p>

      <div className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Webhook URL
        </div>
        <CopyableContent value={webhookUrl} />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Try it out
        </div>
        <CopyableContent value={curlExample} />
      </div>

      {/* How it works */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Terminal className="size-4" />
          How it works
        </div>
        <ol className="space-y-1.5 pl-5 text-sm text-muted-foreground list-decimal">
          <li>Push your code to your Git repository</li>
          <li>Your CI pipeline sends a POST request to this URL</li>
          <li>Valet pulls the latest image and updates the stack</li>
        </ol>
      </div>

      <Button onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  );
};

export { SuccessStep };