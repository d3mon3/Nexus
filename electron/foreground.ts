/**
 * Which app is in front (Windows). One small hidden PowerShell process asks Windows for the
 * foreground window's process name twice a second — no native modules, nothing touches the
 * game. Used to show in-game widgets only while League itself is on screen.
 */
import { spawn, type ChildProcess } from "node:child_process";

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NexusFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}
"@
$last = ''
while ($true) {
  $p = 0
  [void][NexusFg]::GetWindowThreadProcessId([NexusFg]::GetForegroundWindow(), [ref]$p)
  $n = ''
  if ($p -ne 0) { $n = (Get-Process -Id $p).ProcessName }
  if ($n -ne $last) { [Console]::Out.WriteLine($n); [Console]::Out.Flush(); $last = $n }
  Start-Sleep -Milliseconds 400
}
`;

export class ForegroundWatcher {
  private proc: ChildProcess | null = null;
  current = "";

  constructor(private onChange: (processName: string) => void) {}

  start() {
    if (this.proc || process.platform !== "win32") return;
    const p = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SCRIPT], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    this.proc = p;
    let buf = "";
    p.stdout?.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const name = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        this.current = name;
        this.onChange(name);
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
