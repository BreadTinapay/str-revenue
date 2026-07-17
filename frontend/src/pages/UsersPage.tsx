import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  createUser,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  updateUserRole,
  type AppUser,
} from "../lib/api";
import { useAuth } from "../lib/auth";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { email: myEmail } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  async function handleRoleChange(user: AppUser, role: string) {
    await updateUserRole(user.id, role);
    invalidate();
  }

  async function handleDelete(user: AppUser) {
    if (!window.confirm(`Remove ${user.email}'s access? This cannot be undone.`)) return;
    await deleteUser(user.id);
    invalidate();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage who has access to this dashboard</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New user
        </Button>
      </div>

      {showForm && (
        <NewUserForm
          onCreated={() => {
            setShowForm(false);
            invalidate();
          }}
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && users?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
                        <UsersIcon className="h-5 w-5" />
                      </div>
                      <p>No users yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {users?.map((user) => {
                const isSelf = user.email === myEmail;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">
                      {user.email}
                      {isSelf && (
                        <Badge variant="outline" className="ml-2">
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(role) => handleRoleChange(user, role)}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reset password"
                          onClick={() => setResettingId(resettingId === user.id ? null : user.id)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete user"
                          disabled={isSelf}
                          onClick={() => handleDelete(user)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {resettingId === user.id && (
                        <ResetPasswordRow
                          userId={user.id}
                          onDone={() => {
                            setResettingId(null);
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function ResetPasswordRow({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await resetUserPassword(userId, password);
      setDone(true);
      setTimeout(onDone, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <p className="mt-2 text-right text-xs text-success">Password reset.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex justify-end gap-2">
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        className="h-8 w-40 text-xs"
      />
      <Button type="submit" size="sm" disabled={submitting}>
        Set
      </Button>
    </form>
  );
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createUser({ email, password, role });
      onCreated();
    } catch {
      setError("Failed to create user — email may already be in use.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="teammate@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-4">
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create user"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
