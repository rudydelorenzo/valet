"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types/api";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = () =>
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setCurrentUserId(data.user?.id));
    load();
  }, []);

  const toggleAdmin = async (user: User) => {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to update user");
      return;
    }
    toast.success(
      user.isAdmin
        ? `${user.name} is no longer an admin`
        : `${user.name} is now an admin`,
    );
    load();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const adminCount = users.filter((u) => u.isAdmin).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage user access and admin privileges.
        </p>
      </div>

      <Card>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const isLastAdmin = user.isAdmin && adminCount === 1;
                const canToggle = !isLastAdmin;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isAdmin ? "default" : "secondary"}>
                        {user.isAdmin ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!canToggle}
                        onClick={() => toggleAdmin(user)}
                        title={
                          isLastAdmin
                            ? "Can't remove the last admin"
                            : isCurrentUser
                              ? user.isAdmin
                                ? "Remove own admin (last admin blocks this)"
                                : "Make yourself admin"
                              : user.isAdmin
                                ? "Remove admin"
                                : "Make admin"
                        }
                      >
                        {user.isAdmin ? (
                          <ShieldOff className="size-4" />
                        ) : (
                          <ShieldCheck className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersPage;