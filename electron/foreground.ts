/**
 * Which app is in front (Windows), plus NEXUS hotkeys while League is in front.
 *
 * One small hidden PowerShell process asks Windows for the foreground window's process name
 * (every 400 ms) and — only while League (game or client) or NEXUS itself is in front — reads
 * the state of the Alt key and the hotkey letters (every 50 ms). No global hotkeys are
 * registered, so Alt+letter keeps working normally in every other app and game. League reads the keyboard with raw input and blocks
 * normal global hotkeys, so this is how Alt+X & co. work in game. Nothing touches the game:
 * GetAsyncKeyState only reads whether a key is held down.
 */
import { spawn, type ChildProcess } from "node:child_process";

const ps = (v: string) => `'${v.replace(/'/g, "''")}'`;
const script = (keys: number[], hotApps: string[]) => `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NexusFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
}
"@
$keys = @(${keys.join(",")})
$hot = @(${hotApps.map(ps).join(",")})
$down = @{}
$last = ''
$game = $false
$i = 0
while ($true) {
  if ($i % 8 -eq 0) {
    $p = 0
    [void][NexusFg]::GetWindowThreadProcessId([NexusFg]::GetForegroundWindow(), [ref]$p)
    $n = ''
    if ($p -ne 0) { $n = (Get-Process -Id $p).ProcessName }
    if ($n -ne $last) { [Console]::Out.WriteLine("FG:" + $n); [Console]::Out.Flush(); $last = $n }
    $game = ($hot -contains $n)
  }
  if ($game -and $keys.Count -gt 0) {
    $alt = ([NexusFg]::GetAsyncKeyState(0x12) -band 0x8000) -ne 0
    foreach ($k in $keys) {
      $pressed = $alt -and (([NexusFg]::GetAsyncKeyState($k) -band 0x8000) -ne 0)
      if ($pressed -and -not $down[$k]) { [Console]::Out.WriteLine("KEY:" + $k); [Console]::Out.Flush() }
      $down[$k] = $pressed
    }
  }
  $i++
  Start-Sleep -Milliseconds 50
}
`;

export class ForegroundWatcher {
  private proc: ChildProcess | null = null;
  private keys: number[] = [];
  current = "";

  constructor(
    private onChange: (processName: string) => void,
    private onKey: (letter: string) => void = () => undefined,
    /** Process names (without .exe) where the hotkeys work. */
    private hotApps: string[] = ["League of Legends"],
  ) {}

  get running() {
    return Boolean(this.proc);
  }

  /** Letters (A–Z) that trigger onKey together with Alt while League is in front. */
  setKeys(letters: string[]) {
    const next = [...new Set(letters.map((l) => l.toUpperCase()).filter((l) => /^[A-Z]$/.test(l)).map((l) => l.charCodeAt(0)))];
    if (next.join() === this.keys.join()) return;
    this.keys = next;
    if (this.proc) {
      this.stop();
      this.start();
    }
  }

  start() {
    if (this.proc || process.platform !== "win32") return;
    const p = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script(this.keys, this.hotApps)], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    this.proc = p;
    let buf = "";
    p.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.startsWith("KEY:")) this.onKey(String.fromCharCode(Number(line.slice(4))));
        else if (line.startsWith("FG:")) {
          this.current = line.slice(3);
          this.onChange(this.current);
        }
      }
    });
    p.on("exit", () => {
      if (this.proc === p) this.proc = null;
    });
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
    this.current = "";
  }
}

/** League's in-game process ("League of Legends.exe"). */
export const isGameProcess = (name: string) => /^league of legends$/i.test(name);

/** League client windows (lobby, champ select). */
export const isClientProcess = (name: string) => /^leagueclient(ux(render)?)?$/i.test(name);
