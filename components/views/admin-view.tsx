"use client";

import { CircleCheck, KeyRound, Lock, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "../layout/logo";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";

interface AdminStatus {
  key: { set: boolean; masked: string | null; updatedAt: string | null; rejected: boolean; check: { ok: boolean; message: string } | null };
  demoDisabled: boolean;
  database: boolean;
  aggregate: { patch: string; platform: string; rankBand: string; matches: number; finishedAt: string }[];
}

const PW_KEY = "nexus.admin.pw";

function readPw() {
  try {
    return sessionStorage.getItem(PW_KEY) ?? "";
  } catch {
    return "";
  }
}
function writePw(pw: string | null) {
  try {
    if (pw) sessionStorage.setItem(PW_KEY, pw);
    else sessionStorage.removeItem(PW_KEY);
  } catch {
    /* private mode — the password simply isn't remembered */
  }
}

async function call<T>(path: string, pw: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", "x-admin-password": pw, ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
  return body as T;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL") : "—");

/** /admin — lets the server owner paste or rotate the Riot API key from a phone. */
export function AdminView() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async (password: string, test = false) => {
    setBusy(true);
    setError(null);
    try {
      const s = await call<AdminStatus>(`/api/admin/status${test ? "?test=1" : ""}`, password);
      setStatus(s);
      setAuthed(true);
      writePw(password);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401 || err.status === 429 || err.status === 403) {
        setAuthed(false);
        writePw(null);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const stored = readPw();
    if (stored) {
      setPw(stored);
      void load(stored);
    }
  }, [load]);

  const saveKey = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const r = await call<{ message: string }>("/api/admin/key", pw, { method: "POST", body: JSON.stringify({ key: newKey.trim() }) });
      setSaved(r.message);
      setNewKey("");
      await load(pw);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const keyState = !status?.key.set ? (
    <Badge variant="warning">brak klucza</Badge>
  ) : status.key.rejected || status.key.check?.ok === false ? (
    <Badge variant="danger">klucz odrzucony / wygasł</Badge>
  ) : (
    <Badge variant="success">ustawiony</Badge>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <span className="text-xs font-semibold uppercase tracking-wider text-dim">Panel serwera</span>
      </div>

      {!authed ? (
        <Card className="p-5">
          <h1 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Lock className="size-4 text-primary" /> Logowanie administratora
          </h1>
          <p className="mb-4 text-sm text-muted">Hasło zostało wypisane na końcu instalacji serwera (ADMIN_PASSWORD w pliku .env).</p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void load(pw);
            }}
          >
            <Input type="password" autoComplete="current-password" placeholder="Hasło administratora" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Hasło administratora" />
            <Button type="submit" variant="primary" disabled={!pw || busy}>
              {busy ? "Sprawdzam…" : "Zaloguj"}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h1 className="flex items-center gap-2 text-lg font-bold">
                <KeyRound className="size-4 text-primary" /> Klucz Riot API
              </h1>
              {keyState}
            </div>
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Aktualny</dt>
              <dd className="font-mono text-fg">{status?.key.masked ?? "—"}</dd>
              <dt className="text-muted">Zmieniony</dt>
              <dd>{fmtDate(status?.key.updatedAt ?? null)}</dd>
              {status?.key.check && (
                <>
                  <dt className="text-muted">Test</dt>
                  <dd className={status.key.check.ok ? "text-success" : "text-danger"}>{status.key.check.message}</dd>
                </>
              )}
            </dl>

            <label className="mb-1.5 block text-sm font-medium" htmlFor="riot-key">
              Wklej nowy klucz
            </label>
            <Input id="riot-key" placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={newKey} onChange={(e) => setNewKey(e.target.value)} autoComplete="off" spellCheck={false} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" disabled={!newKey.trim() || busy} onClick={saveKey}>
                {busy ? "Sprawdzam klucz…" : "Zapisz klucz"}
              </Button>
              <Button variant="secondary" disabled={busy || !status?.key.set} onClick={() => load(pw, true)}>
                <RefreshCw className="size-4" /> Sprawdź obecny
              </Button>
            </div>
            {saved && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
                <CircleCheck className="size-4" /> {saved}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <p className="mt-4 text-xs leading-relaxed text-dim">
              Klucz bierzesz z developer.riotgames.com. Klucz deweloperski wygasa po 24 h — wtedy wklej tu nowy. Klucz zostaje na serwerze i nigdy nie trafia do aplikacji ani przeglądarek znajomych.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base font-bold">Statystyki championów</h2>
            <p className="mb-2 text-sm text-muted">Baza danych: {status?.database ? "połączona" : "brak"}</p>
            {status?.aggregate.length ? (
              <ul className="space-y-1.5 text-sm">
                {status.aggregate.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2 rounded-xl border border-line-soft px-3 py-2">
                    <span>
                      Patch {r.patch} · {r.platform.toUpperCase()} · {r.rankBand}
                    </span>
                    <span className="text-muted tabular">
                      {r.matches} meczów · {fmtDate(r.finishedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2 text-sm text-muted">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                Jeszcze nic nie zebrano. Zbieranie startuje samo kilka minut po dodaniu klucza i powtarza się co noc.
              </p>
            )}
          </Card>

          <Button
            variant="ghost"
            className="self-center"
            onClick={() => {
              writePw(null);
              setAuthed(false);
              setPw("");
              setStatus(null);
            }}
          >
            <LogOut className="size-4" /> Wyloguj
          </Button>
        </>
      )}
    </main>
  );
}
