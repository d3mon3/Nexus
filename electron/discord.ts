/**
 * Minimal Discord Rich Presence client over Discord's local IPC socket (no dependency).
 * Protocol: frames of [opcode:int32le][length:int32le][json]. Op 0 = handshake, op 1 = frame.
 * Needs a Discord application id (NEXUS_DISCORD_CLIENT_ID at build time); without one it is a no-op.
 */
import net from "node:net";
import os from "node:os";
import path from "node:path";

export interface Activity {
  details?: string;
  state?: string;
  startTimestamp?: number;
  largeImageUrl?: string;
  largeText?: string;
  smallImageUrl?: string;
  smallText?: string;
  buttons?: { label: string; url: string }[];
}

function pipePaths(): string[] {
  if (process.platform === "win32") return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || os.tmpdir();
  return Array.from({ length: 10 }, (_, i) => path.join(base, `discord-ipc-${i}`));
}

function encode(op: number, data: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(data), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

export class DiscordPresence {
  private socket: net.Socket | null = null;
  private ready = false;
  private connecting = false;
  private pending: Activity | null | undefined;
  private lastKey = "";
  private retryAt = 0;

  constructor(private clientId: string) {}

  get enabled() {
    return Boolean(this.clientId);
  }

  private connect() {
    if (!this.enabled || this.connecting || this.socket || Date.now() < this.retryAt) return;
    this.connecting = true;
    const paths = pipePaths();
    const tryPath = (i: number) => {
      if (i >= paths.length) {
        this.connecting = false;
        this.retryAt = Date.now() + 30_000; // Discord not running — try again later
        return;
      }
      const s = net.createConnection(paths[i]);
      s.once("connect", () => {
        this.socket = s;
        this.connecting = false;
        s.write(encode(0, { v: 1, client_id: this.clientId }));
      });
      s.once("error", () => {
        s.destroy();
        if (!this.socket) tryPath(i + 1);
      });
      let buf = Buffer.alloc(0);
      s.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 8) {
          const len = buf.readInt32LE(4);
          if (buf.length < 8 + len) break;
          const msg = JSON.parse(buf.subarray(8, 8 + len).toString("utf8")) as { evt?: string };
          buf = buf.subarray(8 + len);
          if (msg.evt === "READY") {
            this.ready = true;
            if (this.pending !== undefined) this.send(this.pending);
          }
        }
      });
      s.on("close", () => {
        if (this.socket === s) {
          this.socket = null;
          this.ready = false;
          this.lastKey = "";
          this.retryAt = Date.now() + 15_000;
        }
      });
    };
    tryPath(0);
  }

  private send(activity: Activity | null) {
    if (!this.socket || !this.ready) return;
    const payload = activity
      ? {
          details: activity.details?.slice(0, 128),
          state: activity.state?.slice(0, 128),
          timestamps: activity.startTimestamp ? { start: Math.floor(activity.startTimestamp / 1000) } : undefined,
          assets: {
            large_image: activity.largeImageUrl,
            large_text: activity.largeText,
            small_image: activity.smallImageUrl,
            small_text: activity.smallText,
          },
          buttons: activity.buttons?.slice(0, 2),
          instance: false,
        }
      : null;
    this.socket.write(encode(1, { cmd: "SET_ACTIVITY", args: { pid: process.pid, activity: payload }, nonce: `${Date.now()}${Math.random()}` }));
  }

  /** Sets (or clears with null) the presence; repeated identical calls are ignored. */
  update(activity: Activity | null) {
    if (!this.enabled) return;
    const key = JSON.stringify(activity);
    if (key === this.lastKey && this.ready) return;
    this.pending = activity;
    if (!this.socket) return this.connect();
    if (this.ready) {
      this.lastKey = key;
      this.send(activity);
    }
  }

  close() {
    try {
      if (this.ready) this.send(null);
      this.socket?.end();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }
}
