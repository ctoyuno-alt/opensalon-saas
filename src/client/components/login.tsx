import { useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { User } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Stethoscope } from "lucide-preact";

export function Login() {
  const { setCurrentUser, setError } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ user: User; token: string }>("POST", "/api/auth/login", { username, password });
      localStorage.setItem("auth_token", res.token);
      setCurrentUser(res.user);
      window.location.reload(); // Reload to fetch all initial data cleanly
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Stethoscope className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl">OpenSalon</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-center text-sm text-muted-foreground mt-4">
              <p>Default admin login:</p>
              <p className="font-mono mt-1">admin / password</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
