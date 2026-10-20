import { listUsers } from "@/lib/db/users";

export const GET = async () => {
  return Response.json(await listUsers());
};