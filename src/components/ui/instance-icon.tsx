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
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return <Server className="size-4 text-muted-foreground" />;
  }

  return (
    <>
      {!loaded && <Server className="size-4 text-muted-foreground" />}
      <img
        src={`/api/instances/${id}/favicon`}
        alt=""
        className={className}
        style={!loaded ? { position: "absolute", opacity: 0 } : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
};

export { InstanceIcon };