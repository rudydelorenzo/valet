"use client";

import { useState } from "react";
import { Server } from "lucide-react";

const InstanceIcon = ({
  id,
  className = "size-full object-cover",
}: {
  id: string;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <Server className="size-4 text-muted-foreground" />;
  }

  return (
    <img
      src={`/api/instances/${id}/favicon`}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

export { InstanceIcon };