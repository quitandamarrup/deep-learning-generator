import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  adminListTokens,
  adminCreateToken,
  adminDisableTokenV2,
  adminDeleteToken,
} from "@/lib/admin-tokens.functions";
import { adminLogout, adminMe } from "@/lib/admin-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, Plus, Ban, ArrowLeft, Copy, LogOut, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/tokens")({
  head: () => ({
    meta: [{ title: "Admin — Manajemen Token Download" }],
  }),
  component: AdminTokens,
});

type TokenRow = {
  id: string;
  token: string;
  status: string;
  user_id: string | null;
  user_email: string | null;
  subject: string | null;
  level: string | null;
  class_phase: string | null;
  redeemed_at: string | null;
  created_at: string;
};

function AdminTokens() {
  const runList = useServerFn(adminListTokens);
  const runCreate = useServerFn(adminCreateToken);
  const runDisable = useServerFn(adminDisableTokenV2);
  const runDelete = useServerFn(adminDeleteToken);
  const runLogout = useServerFn(adminLogout);
  const runMe = useServerFn(adminMe);
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    runMe()
      .then((r) => {
        if (!r.isAdmin) {
          navigate({ to: "/admin" });
          return;
        }
        setReady(true);
      })
      .catch(() => navigate({ to: "/admin" }));
  }, [runMe, navigate]);

  const refresh = async () => {
    try {
      const r = await runList();
      setRows(r.tokens as TokenRow[]);
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat token.");
    }
  };

  useEffect(() => {
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const create = async () => {
    const n = parseInt(count, 10);
    if (!n || n < 1) {
      toast.error("Jumlah tidak valid.");
      return;
    }
    setBusy(true);
    try {
      const r = await runCreate({ data: { count: n } });
      toast.success(`${r.tokens.length} token dibuat.`);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat token.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (id: string) => {
    if (!confirm("Nonaktifkan token ini?")) return;
    try {
      await runDisable({ data: { id } });
      toast.success("Token dinonaktifkan.");
      refresh();
    } catch {
      toast.error("Gagal menonaktifkan token.");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Hapus token ini? Hanya berlaku bila belum digunakan.")) return;
    try {
      const r = await runDelete({ data: { id } });
      if (r.ok) {
        toast.success("Token dihapus.");
        refresh();
      } else {
        toast.error(r.reason ?? "Gagal menghapus token.");
      }
    } catch {
      toast.error("Gagal menghapus token.");
    }
  };

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Token disalin.");
  };

  const logout = async () => {
    await runLogout();
    toast.success("Anda telah keluar dari admin.");
    navigate({ to: "/admin" });
  };

  if (!ready) return <div className="p-10 text-center text-slate-500">Memuat...</div>;

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
          <h1 className="text-lg font-bold sm:text-xl flex-1">Manajemen Token Download</h1>
          <Button
            size="sm"
            variant="secondary"
            onClick={logout}
            className="bg-white/10 text-white hover:bg-white/20 border-0"
          >
            <LogOut className="mr-1.5 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Buat Token Baru</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-32"
            />
            <Button onClick={create} disabled={busy} className="bg-[#0f2b5b] hover:bg-[#0a1f45]">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Buat Token
            </Button>
            <span className="text-xs text-slate-500">
              Format ADM-XXXX-XXXX, acak kriptografis. Maks 200 per batch.
            </span>
          </div>
        </section>

        <section className="mt-6 rounded-lg border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Daftar Token</h2>
            <Button variant="outline" size="sm" onClick={refresh}>Refresh</Button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border px-2 py-1.5">Token</th>
                  <th className="border px-2 py-1.5">Status</th>
                  <th className="border px-2 py-1.5">User</th>
                  <th className="border px-2 py-1.5">Mata Pelajaran</th>
                  <th className="border px-2 py-1.5">Semester</th>
                  <th className="border px-2 py-1.5">Jenjang</th>
                  <th className="border px-2 py-1.5">Kelas/Fase</th>
                  <th className="border px-2 py-1.5">Dibuat</th>
                  <th className="border px-2 py-1.5">Digunakan</th>
                  <th className="border px-2 py-1.5">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="border px-2 py-6 text-center text-slate-500">
                      Belum ada token.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="border px-2 py-1.5 font-mono">
                      <div className="flex items-center gap-2">
                        <span>{r.token}</span>
                        <button onClick={() => copy(r.token)} className="text-slate-500 hover:text-slate-800">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="border px-2 py-1.5">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          r.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "redeemed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="border px-2 py-1.5 text-xs">
                      {r.user_email ?? (r.user_id ? r.user_id.slice(0, 8) + "…" : "-")}
                    </td>
                    <td className="border px-2 py-1.5">{r.subject ?? "-"}</td>
                    <td className="border px-2 py-1.5">{r.level ?? "-"}</td>
                    <td className="border px-2 py-1.5">{r.class_phase ?? "-"}</td>
                    <td className="border px-2 py-1.5 text-xs">
                      {new Date(r.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="border px-2 py-1.5 text-xs">
                      {r.redeemed_at ? new Date(r.redeemed_at).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="border px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {r.status !== "disabled" && r.status !== "redeemed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => disable(r.id)}
                            className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" /> Disable
                          </Button>
                        )}
                        {!r.user_id && !r.redeemed_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => del(r.id)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
