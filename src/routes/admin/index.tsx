import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { adminLogin, adminMe } from "@/lib/admin-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Login Admin — Administrasi Pembelajaran" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const runLogin = useServerFn(adminLogin);
  const runMe = useServerFn(adminMe);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    runMe()
      .then((r) => {
        if (r.isAdmin) navigate({ to: "/admin/tokens" });
      })
      .catch(() => {});
  }, [runMe, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Lengkapi username dan password.");
      return;
    }
    setBusy(true);
    try {
      const r = await runLogin({ data: { username, password } });
      if (r.ok) {
        toast.success("Login admin berhasil.");
        navigate({ to: "/admin/tokens" });
      } else {
        toast.error("Username atau password salah.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal login.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-center" />
      <header className="bg-[#0f2b5b] text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
          <Link to="/">
            <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Beranda
            </Button>
          </Link>
          <h1 className="text-lg font-bold sm:text-xl">Login Admin</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#0f2b5b]" />
            <h2 className="text-base font-semibold text-slate-800">Manajemen Token Download</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Halaman ini hanya untuk administrator. Silakan masuk dengan kredensial admin.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="u">Username</Label>
              <Input
                id="u"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input
                id="p"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-[#0f2b5b] hover:bg-[#0a1f45]"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Masuk sebagai Admin
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
