"use client";
/**
 * CoBuilding.tsx — espace de co-construction en temps réel
 * ---------------------------------------------------------------------------
 * Un seul fichier, aucune dépendance autre que React 18+.
 *
 *  • Code partagé  : fichiers multi-technologies, éditeur Monaco et arbre de projet
 *  • Tâches        : tableau À faire / En cours / Terminé (glisser-déposer ou flèches)
 *  • Discussion    : chat d'équipe + annonces d'arrivée et de départ
 *  • Présence      : avatars, curseurs en direct, indicateur « écrit… »
 *  • Hors-ligne    : les modifications faites sans réseau se rejoignent à la reconnexion
 *
 * Synchronisation
 *  Chaque modification est une opération LWW (« dernier écrit gagne », horloge de
 *  Lamport + identifiant de site). Le texte est un ensemble de lignes identifiées,
 *  ordonnées par position fractionnaire : deux personnes qui écrivent sur des lignes
 *  différentes ne se gênent jamais, et tous les clients convergent vers le même état.
 *  Deux personnes qui modifient la même ligne au même instant : la dernière frappe
 *  l'emporte. L'éditeur Monaco fournit coloration syntaxique et outils de code.
 *
 * Transports
 *  • BroadcastTransport (par défaut) : temps réel entre onglets/fenêtres, sans serveur
 *  • WebSocketTransport              : équipe distribuée, via un relais (voir relay-server.mjs)
 *  • Ou n'importe quel objet qui implémente `Transport` (WebRTC, Ably, Pusher, Supabase…)
 *
 * Utilisation
 *   <CoBuilding />                                            // démo multi-onglets
 *   <CoBuilding roomId="projet-42" wsUrl="wss://exemple.fr/co" user={{ name: "Aina" }} />
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import MonacoEditor from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { editor as MonacoEditorApi } from "monaco-editor";
import { Archive, Check, ChevronDown, ChevronRight, ClipboardList, Code2, Download, FileCode2, FilePlus2, Folder, FolderOpen, FolderUp, Github, History, LoaderCircle, MessageCircle, Plus, Save, Search, Trash2, Upload, UserPlus, UsersRound, X } from "lucide-react";
import { createProjectArchive } from "@/co-building/archive";
import { Avatar as ProfileAvatar } from "@/components/Avatar";
import { FileIconBadge } from "@/components/ide/FileIcon";
import { connectGit, getGitSessionToken, pushGitHubChanges, setGitSessionToken } from "@/lib/ide/git-client";
import type { ProjectFile } from "@/types/ide";

/* ═══════════════════════════════ Types ═══════════════════════════════════ */

export type Id = string;
type Stamp = [number, Id]; // [horloge de Lamport, site]
type Who = { id: Id; name: string; color: string; image?: string | null };

export interface CoUser extends Who {}
export interface Line { id: Id; text: string; pos: number; ts: Stamp; deleted: boolean }
export type TaskStatus = "todo" | "doing" | "done";
export interface Task {
  id: Id;
  title: string;
  status: TaskStatus;
  assignee: Who | null;
  at: number;
  ts: Stamp;
  deleted: boolean;
}
export interface ChatMsg { id: Id; from: Who; text: string; at: number; replyTo?: Id; deleted?: boolean; local?: boolean }
export type ActivityAction = "file_created" | "file_imported" | "file_modified" | "file_deleted" | "task_created" | "task_updated" | "task_deleted";
export interface CoBuildingActivity { id: Id; actor: CoUser; action: ActivityAction; target: string; at: number }
export interface Peer { user: CoUser; file?: string; line?: number; typing?: boolean; seen: number }
interface Presence { user: CoUser; file?: string; line?: number; typing?: boolean; cursor?: { x: number; y: number } | null }

export type Msg =
  | { t: "hello"; user: CoUser }
  | { t: "state"; to: Id; files: [string, Line[]][]; tasks: Task[]; chat: ChatMsg[]; history?: CoBuildingActivity[]; clock: number }
  | { t: "lines"; file: string; lines: Line[] }
  | { t: "task"; task: Task }
  | { t: "chat"; msg: ChatMsg }
  | { t: "chat_delete"; id: Id }
  | { t: "chat_delete_result"; id: Id; success: boolean }
  | { t: "activity"; activity: CoBuildingActivity }
  | { t: "save"; id: Id }
  | { t: "save_result"; id: Id; success: boolean }
  | { t: "presence"; p: Presence }
  | { t: "bye"; id: Id };

export interface Envelope { room: string; from: Id; body: Msg }
export type LinkState = "connecting" | "online" | "offline";

export interface Transport {
  start(room: string, onMessage: (e: Envelope) => void, onStatus: (s: LinkState) => void): void;
  send(e: Envelope): void;
  stop(): void;
}

/* ═════════════════════════════ Utilitaires ═══════════════════════════════ */

const newer = (a: Stamp, b: Stamp) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const PALETTE = ["#8cff00", "#0878ff", "#35b5ff", "#ff7a90", "#a4ff42", "#8b6cff", "#ff9f5a", "#e08bff"];
const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Reporte un index de curseur d'un ancien texte vers le nouveau (préfixe/suffixe communs). */
export function mapIndex(oldText: string, newText: string, i: number): number {
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let q = 0;
  while (q < max - p && oldText[oldText.length - 1 - q] === newText[newText.length - 1 - q]) q++;
  if (i <= p) return i;
  if (i >= oldText.length - q) return i + (newText.length - oldText.length);
  return p + Math.min(i - p, newText.length - q - p);
}

/* ═════════════════════════════ Transports ════════════════════════════════ */

/** Temps réel entre onglets du même navigateur. Idéal pour tester sans serveur. */
export class BroadcastTransport implements Transport {
  private ch: BroadcastChannel | null = null;
  start(room: string, onMessage: (e: Envelope) => void, onStatus: (s: LinkState) => void) {
    if (typeof BroadcastChannel === "undefined") return onStatus("offline");
    this.ch = new BroadcastChannel(`cobuilding:${room}`);
    this.ch.onmessage = (ev) => onMessage(ev.data as Envelope);
    onStatus("online");
  }
  send(e: Envelope) { this.ch?.postMessage(e); }
  stop() { this.ch?.close(); this.ch = null; }
}

/** Relais WebSocket : le serveur renvoie chaque message aux autres clients de la salle. */
export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stableTimer: ReturnType<typeof setTimeout> | undefined;
  private queue: string[] = [];
  constructor(private url: string, private ticket?: string) {}

  start(room: string, onMessage: (e: Envelope) => void, onStatus: (s: LinkState) => void) {
    this.closed = false;
    const open = () => {
      if (this.closed) return;
      onStatus("connecting");
      const u = new URL(this.url, window.location.href);
      u.searchParams.set("room", room);
      if (this.ticket) u.searchParams.set("ticket", this.ticket);
      const ws = new WebSocket(u.toString());
      this.ws = ws;
      ws.onopen = () => {
        if (this.closed || this.ws !== ws) {
          ws.close();
          return;
        }
        this.stableTimer = setTimeout(() => { this.retry = 0; }, 10_000);
        onStatus("online");
        this.queue.splice(0).forEach((m) => ws.send(m));
      };
      ws.onmessage = (ev) => {
        if (this.closed || this.ws !== ws) return;
        try { onMessage(JSON.parse(String(ev.data)) as Envelope); } catch { /* message ignoré */ }
      };
      ws.onerror = () => {
        if (!this.closed && this.ws === ws) ws.close();
      };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        clearTimeout(this.stableTimer);
        if (this.closed) return;
        onStatus("offline");
        this.timer = setTimeout(open, Math.min(8000, 400 * 2 ** this.retry++));
      };
    };
    open();
  }
  send(e: Envelope) {
    const s = JSON.stringify(e);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(s);
    else if (e.body.t === "lines" || e.body.t === "task" || e.body.t === "chat" || e.body.t === "chat_delete") {
      if (this.queue.length < 500) this.queue.push(s); // rejoué à la reconnexion
    }
  }
  stop() {
    this.closed = true;
    clearTimeout(this.timer);
    clearTimeout(this.stableTimer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}

/* ═══════════════════════ Réplique (état partagé + sync) ══════════════════ */

export const DEFAULT_FILES: Record<string, string> = {
  "api.ts": [
    "// Passerelle API partagée par l'équipe",
    "export async function getProjects(token: string) {",
    "  const res = await fetch(\"/api/projects\", {",
    "    headers: { Authorization: `Bearer ${token}` },",
    "  });",
    "  if (!res.ok) throw new Error(\"Impossible de charger les projets\");",
    "  return res.json();",
    "}",
  ].join("\n"),
  "widgets.tsx": [
    "export function StatusWidget({ done, total }: { done: number; total: number }) {",
    "  const pct = total ? Math.round((done / total) * 100) : 0;",
    "  return <progress value={pct} max={100} aria-label=\"Avancement\" />;",
    "}",
  ].join("\n"),
  "notes.md": [
    "# Notes de la session",
    "",
    "- Objectif : brancher l'API sur le tableau de bord",
    "- Qui fait quoi : voir les tâches à gauche",
    "- Décisions : à écrire ici, tout le monde voit en direct",
  ].join("\n"),
};

const SEED_TASKS: Task[] = [
  { id: "seed-1", title: "Intégrer l'API projets", status: "doing", assignee: null, at: 1, ts: [0, "seed"], deleted: false },
  { id: "seed-2", title: "Maquette du widget d'avancement", status: "todo", assignee: null, at: 2, ts: [0, "seed"], deleted: false },
  { id: "seed-3", title: "Revue des microservices", status: "todo", assignee: null, at: 3, ts: [0, "seed"], deleted: false },
];

interface LocalState { file?: string; line?: number; typing?: boolean }

export class Replica {
  clock = 0;
  docs = new Map<string, Map<Id, Line>>();
  tasks = new Map<Id, Task>();
  chat = new Map<Id, ChatMsg>();
  unreadChatCount = 0;
  failedChatDeletes = new Set<Id>();
  peers = new Map<Id, Peer>();
  cursors = new Map<Id, { x: number; y: number }>();
  local: LocalState = {};
  docV = 0; taskV = 0; chatV = 0; activityV = 0; presV = 0; curV = 0; v = 0;
  history: CoBuildingActivity[] = [];
  saveResult: Extract<Msg, { t: "save_result" }> | null = null;
  initialStateLoaded = false;
  locallyModifiedFiles = new Set<string>();

  private subs = new Set<() => void>();
  private curSubs = new Set<() => void>();
  private out: ((m: Msg) => void) | null = null;
  private answered = new Set<Id>();
  private everConnected = false;
  private cache = new Map<string, { v: number; lines: Line[] }>();

  constructor(public me: CoUser, files: Record<string, string> = DEFAULT_FILES, initialTasks: Task[] = SEED_TASKS) {
    for (const [name, content] of Object.entries(files)) {
      const m = new Map<Id, Line>();
      content.split("\n").forEach((text, i) =>
        m.set(`seed:${name}:${i}`, { id: `seed:${name}:${i}`, text, pos: i, ts: [0, "seed"], deleted: false }));
      this.docs.set(name, m);
    }
    initialTasks.forEach((task) => this.tasks.set(task.id, task));
  }

  /* ── abonnements (useSyncExternalStore) ── */
  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  snapshot = () => this.v;
  subscribeCursors = (fn: () => void) => { this.curSubs.add(fn); return () => { this.curSubs.delete(fn); }; };
  cursorSnapshot = () => this.curV;
  private changed(k: "doc" | "task" | "chat" | "pres") {
    if (k === "doc") this.docV++; else if (k === "task") this.taskV++; else if (k === "chat") this.chatV++; else this.presV++;
    this.v++;
    this.subs.forEach((f) => f());
  }

  /* ── réseau ── */
  attach(send: (m: Msg) => void) { this.out = send; }
  detach() { this.out = null; }
  private emit(m: Msg) { this.out?.(m); }
  private tick(): Stamp { return [++this.clock, this.me.id]; }
  private observe(s: Stamp) { if (s[0] > this.clock) this.clock = s[0]; }

  connected() {
    this.emit({ t: "hello", user: this.me });
    this.emit(this.presence());
    this.emit({ t: "state", to: "*", ...this.dump() });
    this.everConnected = true;
  }
  bye() { this.emit({ t: "bye", id: this.me.id }); }
  sendSaveRequest(id: Id) { this.emit({ t: "save", id }); }
  heartbeat() { this.emit(this.presence()); this.prune(); }
  private presence(cursor?: { x: number; y: number } | null): Msg {
    return { t: "presence", p: { user: this.me, file: this.local.file, line: this.local.line, typing: this.local.typing, cursor } };
  }
  setMe(u: CoUser) { this.me = u; this.emit(this.presence()); }
  setLocal(patch: Partial<LocalState>) {
    const next = { ...this.local, ...patch };
    if (next.file === this.local.file && next.line === this.local.line && next.typing === this.local.typing) return;
    this.local = next;
    this.emit(this.presence());
  }
  pointer(pos: { x: number; y: number } | null) { this.emit(this.presence(pos)); }

  dump() {
    return {
      files: [...this.docs].map(([f, m]) => [f, [...m.values()]] as [string, Line[]]),
      tasks: [...this.tasks.values()],
      chat: [...this.chat.values()].filter((m) => !m.local).slice(-200),
      history: this.history,
      clock: this.clock,
    };
  }

  receive(env: Envelope) {
    if (env.from === this.me.id) return;
    const b = env.body;
    switch (b.t) {
      case "hello":
        this.touch(b.user);
        this.answered.delete(b.user.id);
        setTimeout(() => {
          if (!this.answered.has(b.user.id)) this.emit({ t: "state", to: b.user.id, ...this.dump() });
        }, 40 + Math.random() * 260);
        break;
      case "state":
        this.merge(b);
        if (env.from === "server" && b.to === this.me.id && !this.initialStateLoaded) {
          this.initialStateLoaded = true;
          this.changed("pres");
        }
        if (b.to !== "*") this.answered.add(b.to);
        break;
      case "lines": {
        let any = false;
        for (const l of b.lines) any = this.applyLine(b.file, l) || any;
        if (any) this.changed("doc");
        break;
      }
      case "task":
        if (this.applyTask(b.task)) this.changed("task");
        break;
      case "chat":
        if (this.applyChat(b.msg)) {
          if (b.msg.from.id !== this.me.id) this.unreadChatCount++;
          this.changed("chat");
        }
        break;
      case "chat_delete":
        if (this.applyChatDeletion(b.id)) this.changed("chat");
        break;
      case "chat_delete_result":
        this.failedChatDeletes.delete(b.id);
        if (b.success) {
          this.applyChatDeletion(b.id);
        } else {
          const current = this.chat.get(b.id);
          if (current?.from.id === this.me.id && current.deleted) {
            this.chat.set(b.id, { ...current, deleted: false });
          }
          this.failedChatDeletes.add(b.id);
        }
        this.changed("chat");
        break;
      case "activity":
        if (this.applyActivity(b.activity)) this.changed("chat");
        break;
      case "save_result":
        this.saveResult = b;
        this.changed("pres");
        break;
      case "presence":
        this.touch(b.p.user, b.p);
        break;
      case "bye":
        if (this.peers.delete(b.id)) {
          this.cursors.delete(b.id);
          this.curV++; this.curSubs.forEach((f) => f());
          this.changed("pres");
        }
        break;
    }
  }

  private merge(s: Extract<Msg, { t: "state" }>) {
    this.clock = Math.max(this.clock, s.clock);
    let d = false, t = false, c = false;
    for (const [f, lines] of s.files) for (const l of lines) d = this.applyLine(f, l) || d;
    for (const task of s.tasks) t = this.applyTask(task) || t;
    for (const m of s.chat) c = this.applyChat(m) || c;
    for (const activity of s.history ?? []) c = this.applyActivity(activity) || c;
    if (d) this.changed("doc");
    if (t) this.changed("task");
    if (c) this.changed("chat");
  }
  private applyLine(file: string, l: Line): boolean {
    let m = this.docs.get(file);
    if (!m) { m = new Map(); this.docs.set(file, m); }
    const e = m.get(l.id);
    this.observe(l.ts);
    if (e && !newer(l.ts, e.ts)) return false;
    m.set(l.id, l);
    return true;
  }
  private applyActivity(activity: CoBuildingActivity): boolean {
    if (this.history.some((entry) => entry.id === activity.id)) return false;
    this.history.push(activity);
    if (this.history.length > 1_000) this.history.splice(0, this.history.length - 1_000);
    this.activityV++;
    return true;
  }
  private recordActivity(action: ActivityAction, target: string) {
    if (action === "file_modified" && this.history.some((event) =>
      event.actor.id === this.me.id && event.action === action && event.target === target && Date.now() - event.at < 30_000)) return;
    const activity: CoBuildingActivity = {
      id: uid(), actor: { ...this.me }, action, target, at: Date.now(),
    };
    if (this.applyActivity(activity)) {
      this.changed("chat");
      this.emit({ t: "activity", activity });
    }
  }
  private applyTask(t: Task): boolean {
    const e = this.tasks.get(t.id);
    this.observe(t.ts);
    if (e && !newer(t.ts, e.ts)) return false;
    this.tasks.set(t.id, t);
    return true;
  }
  private applyChat(m: ChatMsg): boolean {
    const current = this.chat.get(m.id);
    if (current) {
      if (m.deleted && !current.deleted) {
        this.chat.set(m.id, { ...current, deleted: true });
        return true;
      }
      return false;
    }
    this.chat.set(m.id, m);
    if (this.chat.size > 300) {
      const oldest = [...this.chat.values()].sort((a, b) => a.at - b.at)[0];
      this.chat.delete(oldest.id);
    }
    return true;
  }
  private applyChatDeletion(id: Id): boolean {
    const message = this.chat.get(id);
    if (!message || message.deleted) return false;
    this.chat.set(id, { ...message, deleted: true });
    return true;
  }
  markChatRead() {
    if (this.unreadChatCount === 0) return;
    this.unreadChatCount = 0;
    this.changed("chat");
  }

  /* ── présence ── */
  private touch(user: CoUser, p?: Presence) {
    const prev = this.peers.get(user.id);
    const next: Peer = p
      ? { user, file: p.file, line: p.line, typing: p.typing, seen: Date.now() }
      : { ...(prev ?? { user }), user, seen: Date.now() };
    this.peers.set(user.id, next);
    if (!prev) this.notice(`${user.name} a rejoint l'espace`);
    if (!prev || prev.user.name !== user.name || prev.user.color !== user.color || prev.user.image !== user.image ||
        prev.file !== next.file || prev.line !== next.line || prev.typing !== next.typing) this.changed("pres");
    if (p && p.cursor !== undefined) {
      if (p.cursor) this.cursors.set(user.id, p.cursor); else this.cursors.delete(user.id);
      this.curV++;
      this.curSubs.forEach((f) => f());
    }
  }
  private prune() {
    const limit = Date.now() - 7000;
    let any = false;
    for (const [id, p] of this.peers) {
      if (p.seen < limit) {
        this.peers.delete(id); this.cursors.delete(id); any = true;
        this.notice(`${p.user.name} a quitté l'espace`);
      }
    }
    if (any) { this.curV++; this.curSubs.forEach((f) => f()); this.changed("pres"); }
  }
  private notice(text: string) {
    const id = uid();
    this.chat.set(id, { id, from: { id: "system", name: "", color: "" }, text, at: Date.now(), local: true });
    this.changed("chat");
  }

  /* ── texte partagé ── */
  files(): string[] { return [...this.docs.keys()].filter((file) => this.lines(file).length > 0).sort(); }
  lines(file: string): Line[] {
    const c = this.cache.get(file);
    if (c && c.v === this.docV) return c.lines;
    const m = this.docs.get(file);
    const lines = m
      ? [...m.values()].filter((l) => !l.deleted).sort((a, b) => a.pos - b.pos || (a.id < b.id ? -1 : 1))
      : [];
    this.cache.set(file, { v: this.docV, lines });
    return lines;
  }
  text(file: string) { return this.lines(file).map((l) => l.text).join("\n"); }

  /** Traduit un nouveau contenu de textarea en opérations sur les lignes et les diffuse. */
  setText(file: string, next: string, logActivity = true) {
    const old = this.lines(file);
    const nl = next.split("\n");
    let p = 0;
    while (p < old.length && p < nl.length && old[p].text === nl[p]) p++;
    let s = 0;
    while (s < old.length - p && s < nl.length - p && old[old.length - 1 - s].text === nl[nl.length - 1 - s]) s++;
    const oldMid = old.slice(p, old.length - s);
    const newMid = nl.slice(p, nl.length - s);
    const k = Math.min(oldMid.length, newMid.length);
    const ops: Line[] = [];
    for (let i = 0; i < k; i++) if (oldMid[i].text !== newMid[i]) ops.push({ ...oldMid[i], text: newMid[i], ts: this.tick() });
    for (let i = k; i < oldMid.length; i++) ops.push({ ...oldMid[i], deleted: true, ts: this.tick() });
    const extra = newMid.length - k;
    if (extra > 0) {
      const prev = k > 0 ? oldMid[k - 1] : old[p - 1];
      const after = s > 0 ? old[old.length - s] : undefined;
      const lo = prev ? prev.pos : after ? after.pos - 1 : 0;
      const hi = after ? after.pos : lo + 1;
      for (let j = 1; j <= extra; j++) {
        ops.push({ id: uid(), text: newMid[k + j - 1], pos: lo + ((hi - lo) * j) / (extra + 1), ts: this.tick(), deleted: false });
      }
    }
    if (!ops.length) return;
    this.locallyModifiedFiles.add(file);
    ops.forEach((l) => this.applyLine(file, l));
    this.changed("doc");
    this.emit({ t: "lines", file, lines: ops });
    if (logActivity) this.recordActivity("file_modified", file);
  }
  createFile(name: string, logActivity = true): string | null {
    const n = normalizeFilePath(name);
    if (!n || this.files().includes(n)) return n && this.files().includes(n) ? n : null;
    const l: Line = { id: uid(), text: "", pos: 0, ts: this.tick(), deleted: false };
    this.locallyModifiedFiles.add(n);
    this.applyLine(n, l);
    this.changed("doc");
    this.emit({ t: "lines", file: n, lines: [l] });
    if (logActivity) this.recordActivity("file_created", n);
    return n;
  }
  importFile(name: string, content: string): boolean {
    const path = normalizeFilePath(name);
    if (!path) return false;
    this.locallyModifiedFiles.add(path);
    if (!this.files().includes(path) && !this.createFile(path, false)) return false;
    this.setText(path, content, false);
    this.recordActivity("file_imported", path);
    return true;
  }
  deleteFile(path: string) {
    const lines = this.lines(path);
    if (!lines.length) return;
    this.locallyModifiedFiles.add(path);
    const deleted = lines.map((line) => ({ ...line, deleted: true, ts: this.tick() }));
    deleted.forEach((line) => this.applyLine(path, line));
    this.changed("doc");
    this.emit({ t: "lines", file: path, lines: deleted });
    this.recordActivity("file_deleted", path);
  }
  deletePath(path: string) {
    for (const file of this.files().filter((candidate) => candidate === path || candidate.startsWith(`${path}/`))) {
      this.deleteFile(file);
    }
  }

  /* ── tâches ── */
  liveTasks() {
    return [...this.tasks.values()].filter((t) => !t.deleted).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  }
  addTask(title: string) {
    const t: Task = { id: uid(), title: title.trim(), status: "todo", assignee: null, at: Date.now(), ts: this.tick(), deleted: false };
    if (!t.title) return;
    this.tasks.set(t.id, t);
    this.changed("task");
    this.emit({ t: "task", task: t });
    this.recordActivity("task_created", t.title);
  }
  patchTask(id: Id, patch: Partial<Pick<Task, "status" | "assignee" | "title" | "deleted">>) {
    const cur = this.tasks.get(id);
    if (!cur) return;
    const t = { ...cur, ...patch, ts: this.tick() };
    this.tasks.set(id, t);
    this.changed("task");
    this.emit({ t: "task", task: t });
    this.recordActivity(t.deleted && !cur.deleted ? "task_deleted" : "task_updated", t.title);
  }

  /* ── discussion ── */
  say(text: string, replyTo?: Id) {
    const clean = text.trim();
    if (!clean) return;
    const msg: ChatMsg = { id: uid(), from: { ...this.me }, text: clean.slice(0, 1000), at: Date.now(), ...(replyTo ? { replyTo } : {}) };
    this.applyChat(msg);
    this.changed("chat");
    this.emit({ t: "chat", msg });
  }
  deleteChatMessage(id: Id) {
    const message = this.chat.get(id);
    if (!message || message.from.id !== this.me.id || message.deleted) return;
    this.failedChatDeletes.delete(id);
    this.chat.set(id, { ...message, deleted: true });
    this.changed("chat");
    this.emit({ t: "chat_delete", id });
  }
}

/* ═════════════════════════════ Hooks d'identité ══════════════════════════ */

const safeStore = (kind: "localStorage" | "sessionStorage"): Storage | null => {
  try { return typeof window !== "undefined" ? window[kind] : null; } catch { return null; }
};

function useIdentity(partial?: Partial<CoUser>): [CoUser, (name: string) => void] {
  const [me, setMe] = useState<CoUser>(() => {
    const ss = safeStore("sessionStorage");
    const ls = safeStore("localStorage");
    const id = partial?.id ?? ss?.getItem("cb:id") ?? uid();
    try { ss?.setItem("cb:id", id); } catch { /* stockage indisponible */ }
    const name = partial?.name ?? ls?.getItem("cb:name") ?? `Invité ${id.slice(0, 3)}`;
    return { id, name, color: partial?.color ?? colorFor(id), image: partial?.image ?? null };
  });
  const rename = useCallback((name: string) => {
    const n = name.trim().slice(0, 24);
    if (!n) return;
    try { safeStore("localStorage")?.setItem("cb:name", n); } catch { /* ignoré */ }
    setMe((m) => ({ ...m, name: n }));
  }, []);
  return [me, rename];
}

function useRoom(prop?: string): string {
  const [room] = useState(() => {
    if (prop) return prop;
    if (typeof window === "undefined") return "demo";
    const m = /room=([\w-]+)/.exec(window.location.hash);
    if (m) return m[1];
    const r = uid().slice(0, 6);
    try { window.history.replaceState(null, "", `#room=${r}`); } catch { /* ignoré */ }
    return r;
  });
  return room;
}

/* ═══════════════════════════════ Composants ══════════════════════════════ */

export interface CoBuildingProps {
  projectId?: string;
  projectLogoUrl?: string | null;
  githubUrl?: string;
  isOwner?: boolean;
  isFrench?: boolean;
  /** Salle partagée. Par défaut : lue dans l'URL (#room=…) ou générée. */
  roomId?: string;
  user?: Partial<CoUser>;
  /** Transport personnalisé (prioritaire sur wsUrl). */
  transport?: Transport;
  /** URL du relais WebSocket, ex. wss://exemple.fr/co */
  wsUrl?: string;
  /** Ticket signé par l'API pour rejoindre un espace projet. */
  ticket?: string;
  title?: string;
  initialFiles?: Record<string, string>;
  initialTasks?: Task[];
  className?: string;
}

const LANES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "À faire" },
  { id: "doing", label: "En cours" },
  { id: "done", label: "Terminé" },
];

function Avatar({ u, typing, size = 28 }: { u: Who; typing?: boolean; size?: number }) {
  return (
    <span
      className={"cb-av" + (typing ? " cb-av-typing" : "")}
      style={{ background: u.color, width: size, height: size, fontSize: size * 0.4 }}
      title={u.name}
    >
      <ProfileAvatar src={u.image} name={u.name} size={size} />
    </span>
  );
}

function normalizeFilePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, "/");
  if (!path || path.startsWith("/") || /^[a-z]:/i.test(path)) return null;
  const segments = path.split("/");
  if (segments.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f]/.test(part))) return null;
  return path.length <= 128 ? path : null;
}

function getGitHubRepository(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    const [owner, rawRepository] = parts;
    const repository = rawRepository.replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repository)) return null;
    return `${owner}/${repository}`;
  } catch {
    return null;
  }
}

export default function CoBuilding({
  projectId, projectLogoUrl, githubUrl, isOwner = false, isFrench = true,
  roomId, user, transport, wsUrl, ticket, title = "Atelier de co-construction",
  initialFiles = DEFAULT_FILES, initialTasks = SEED_TASKS, className,
}: CoBuildingProps) {
  const room = useRoom(roomId);
  const [me, rename] = useIdentity(user);
  const [replica] = useState(() => new Replica(me, initialFiles, initialTasks));
  const [link, setLink] = useState<LinkState>("connecting");
  const [sidePanel, setSidePanel] = useState<"chat" | "tasks" | "activity" | null>(null);
  useSyncExternalStore(replica.subscribe, replica.snapshot, replica.snapshot);

  useEffect(() => { replica.setMe(me); }, [me, replica]);
  useEffect(() => {
    if (sidePanel === "chat") replica.markChatRead();
  }, [replica, sidePanel, replica.unreadChatCount]);

  useEffect(() => {
    const tr = transport ?? (wsUrl ? new WebSocketTransport(wsUrl, ticket) : new BroadcastTransport());
    replica.attach((body) => tr.send({ room, from: replica.me.id, body }));
    tr.start(
      room,
      (env) => { if (env.room === room) replica.receive(env); },
      (s) => { setLink(s); if (s === "online") replica.connected(); },
    );
    const hb = window.setInterval(() => replica.heartbeat(), 2000);
    const bye = () => replica.bye();
    window.addEventListener("pagehide", bye);
    return () => {
      window.clearInterval(hb);
      window.removeEventListener("pagehide", bye);
      replica.bye();
      tr.stop();
      replica.detach();
    };
  }, [room, transport, wsUrl, ticket, replica]);

  /* curseur en direct : position normalisée dans l'espace de travail */
  const rootRef = useRef<HTMLElement>(null);
  const lastSent = useRef(0);
  const onPointerMove = (e: React.PointerEvent) => {
    const now = performance.now();
    if (now - lastSent.current < 45 || !rootRef.current) return;
    lastSent.current = now;
    const r = rootRef.current.getBoundingClientRect();
    replica.pointer({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const people = [{ user: me, typing: replica.local.typing, file: replica.local.file }, ...[...replica.peers.values()]];

  return (
    <section
      ref={rootRef}
      className={"cb " + (className ?? "")}
      onPointerMove={onPointerMove}
      onPointerLeave={() => replica.pointer(null)}
      aria-label={title}
    >
      <style>{CSS}</style>
      <Header
        title={title}
        link={link}
        me={me}
        people={people}
        onRename={user?.id ? undefined : rename}
        sidePanel={sidePanel}
        onSidePanelChange={setSidePanel}
        unreadChatCount={replica.unreadChatCount}
        projectId={projectId}
        projectLogoUrl={projectLogoUrl}
        isOwner={isOwner}
        isFrench={isFrench}
      />
      <div className={"cb-grid" + (sidePanel ? " cb-grid-panel-open" : "")}>
        <Editor replica={replica} projectTitle={title.replace(/^(?:Espace projet|Project workspace) ·\s*/, "")} connectionState={link} isFrench={isFrench} githubUrl={githubUrl} />
        {sidePanel && <aside className="cb-side-panel">
          <div className="cb-side-tabs" role="tablist" aria-label="Panneau latéral">
            <button type="button" role="tab" aria-selected={sidePanel === "chat"} onClick={() => setSidePanel("chat")}>
              <MessageCircle size={14} aria-hidden="true" /> Discussion
            </button>
            <button type="button" role="tab" aria-selected={sidePanel === "tasks"} onClick={() => setSidePanel("tasks")}>
              <ClipboardList size={14} aria-hidden="true" /> Tâches
            </button>
            <button type="button" className="cb-side-close" onClick={() => setSidePanel(null)} aria-label="Fermer le panneau">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          {sidePanel === "chat" ? <Chat replica={replica} me={me} isFrench={isFrench} />
            : sidePanel === "tasks" ? <Board replica={replica} me={me} />
              : <ActivityHistory replica={replica} isFrench={isFrench} />}
        </aside>}
      </div>
      <Cursors replica={replica} />
    </section>
  );
}

/* ── en-tête ─────────────────────────────────────────────────────────────── */

function Header({ title, link, me, people, onRename, sidePanel, onSidePanelChange, unreadChatCount, projectId, projectLogoUrl, isOwner, isFrench }: {
  title: string; link: LinkState; me: CoUser;
  people: { user: CoUser; typing?: boolean; file?: string }[]; onRename?: (n: string) => void;
  sidePanel: "chat" | "tasks" | "activity" | null;
  onSidePanelChange: (panel: "chat" | "tasks" | "activity" | null) => void;
  unreadChatCount: number;
  projectId?: string;
  projectLogoUrl?: string | null;
  isOwner: boolean;
  isFrench: boolean;
}) {
  const [name, setName] = useState(me.name);
  const [invitesOpen, setInvitesOpen] = useState(false);
  useEffect(() => setName(me.name), [me.name]);
  const label = link === "online" ? "En direct" : link === "connecting" ? "Connexion…" : "Hors ligne, reconnexion";

  return (
    <header className="cb-head">
      <div className="cb-title">
        <h2>{title}</h2>
        <span className={`cb-pill cb-${link}`} role="status"><i />{label}</span>
      </div>
      <div className="cb-people" aria-label={`${people.length} personne(s) présentes`}>
        {people.map((p) => (
          <Avatar key={p.user.id} u={p.user} typing={p.typing} />
        ))}
        <span className="cb-count">{people.length === 1 ? "Vous êtes seul·e" : `${people.length} présents`}</span>
      </div>
      <div className="cb-head-panels" aria-label="Ouvrir les panneaux">
        <button type="button" aria-pressed={sidePanel === "chat"} onClick={() => onSidePanelChange(sidePanel === "chat" ? null : "chat")}>
          <MessageCircle size={14} aria-hidden="true" /> {isFrench ? "Discussion" : "Discussion"}
          {unreadChatCount > 0 && <span className="cb-unread" aria-label={isFrench ? `${unreadChatCount} nouveaux messages` : `${unreadChatCount} new messages`}>{unreadChatCount > 99 ? "99+" : unreadChatCount}</span>}
        </button>
        <button type="button" aria-pressed={sidePanel === "tasks"} onClick={() => onSidePanelChange(sidePanel === "tasks" ? null : "tasks")}>
          <ClipboardList size={14} aria-hidden="true" /> {isFrench ? "Tâches" : "Tasks"}
        </button>
        <button type="button" aria-pressed={sidePanel === "activity"} onClick={() => onSidePanelChange(sidePanel === "activity" ? null : "activity")}>
          <History size={14} aria-hidden="true" /> {isFrench ? "Historique" : "History"}
        </button>
      </div>
      <div className="cb-me">
        {onRename ? (
          <label>
            <span className="cb-sr">Votre nom</span>
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onRename(name)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </label>
        ) : <span className="cb-user-name">{me.name}</span>}
        {projectId && <button type="button" className="cb-invite-trigger" onClick={() => setInvitesOpen(true)}>
          <UserPlus size={15} aria-hidden="true" />
          {isFrench ? "Inviter" : "Invite"}
        </button>}
      </div>
      {invitesOpen && projectId && <InviteMakersModal projectId={projectId} projectLogoUrl={projectLogoUrl} isOwner={isOwner} isFrench={isFrench} onClose={() => setInvitesOpen(false)} />}
    </header>
  );
}

type InviteMaker = {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  skills: string[];
  isOnline: boolean;
  openToCoBuild: boolean;
};

type ProjectCollaborator = {
  id: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  role: string;
  invitedById?: string | null;
  user: { id: string; name: string | null; image: string | null; handle: string | null; headline: string | null };
};

const INVITATION_ROLES = ["CO_BUILDER", "DEVELOPER", "DESIGNER", "PRODUCT", "MARKETER"] as const;
type InvitationRole = typeof INVITATION_ROLES[number];

function InviteMakersModal({ projectId, projectLogoUrl, isOwner, isFrench, onClose }: {
  projectId: string;
  projectLogoUrl?: string | null;
  isOwner: boolean;
  isFrench: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [makerPage, setMakerPage] = useState(0);
  const [role, setRole] = useState<InvitationRole>("CO_BUILDER");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const normalizedSearch = search.trim();
  const makersQuery = useQuery({
    queryKey: ["co-building-invite-makers", projectId, normalizedSearch, makerPage],
    enabled: normalizedSearch.length === 0 || normalizedSearch.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({ all: "1", take: "30", skip: String(makerPage * 30) });
      if (normalizedSearch) params.set("q", normalizedSearch);
      const response = await fetch(`/api/makers?${params}`);
      if (!response.ok) throw new Error("makers_load_failed");
      return await response.json() as { makers: InviteMaker[]; hasMore: boolean };
    },
  });
  const collaboratorsQuery = useQuery({
    queryKey: ["co-building-project-invites", projectId],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/collaborators`);
      if (!response.ok) throw new Error("project_collaborators_load_failed");
      return await response.json() as { collaborators: ProjectCollaborator[] };
    },
  });
  const inviteMutation = useMutation({
    mutationFn: async (maker: InviteMaker) => {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: maker.id, role }),
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
        collaborator?: Pick<ProjectCollaborator, "id" | "userId" | "status" | "role" | "invitedById">;
      } | null;
      if (!response.ok) throw new Error(result?.error ?? "invitation_failed");
      if (!result?.collaborator) throw new Error("invitation_failed");
      return { maker, collaborator: result.collaborator };
    },
    onMutate: (maker) => {
      const queryKey = ["co-building-project-invites", projectId];
      void queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ collaborators: ProjectCollaborator[] }>(queryKey);
      queryClient.setQueryData<{ collaborators: ProjectCollaborator[] }>(queryKey, {
        collaborators: [
          ...(previous?.collaborators ?? []).filter((item) => item.userId !== maker.id),
          {
            id: `pending-${maker.id}`,
            userId: maker.id,
            status: "PENDING",
            role,
            invitedById: session?.user?.id ?? null,
            user: {
              id: maker.id,
              name: maker.name,
              image: maker.image,
              handle: maker.handle,
              headline: maker.headline,
            },
          },
        ],
      });
      return { previous };
    },
    onSuccess: ({ maker, collaborator }) => {
      setError("");
      setNotice(isFrench
        ? `Invitation envoyée à ${maker.name ?? maker.handle ?? "ce maker"}.`
        : `Invitation sent to ${maker.name ?? maker.handle ?? "this maker"}.`);
      queryClient.setQueryData<{ collaborators: ProjectCollaborator[] }>(
        ["co-building-project-invites", projectId],
        (current) => current && ({
          collaborators: current.collaborators.map((item) => item.userId === maker.id
            ? {
                ...item,
                ...collaborator,
                user: {
                  id: maker.id,
                  name: maker.name,
                  image: maker.image,
                  handle: maker.handle,
                  headline: maker.headline,
                },
              }
            : item),
        }),
      );
      void queryClient.invalidateQueries({ queryKey: ["co-building-project-invites", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-hub", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["navigation-counts"] });
    },
    onError: (cause: Error, _maker, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["co-building-project-invites", projectId], context.previous);
      } else {
        queryClient.removeQueries({ queryKey: ["co-building-project-invites", projectId], exact: true });
      }
      const message = cause.message;
      setNotice("");
      setError(message === "COLLABORATION_EXISTS"
        ? (isFrench ? "Ce maker fait déjà partie du projet ou a déjà une invitation en attente." : "This maker is already on the project or has a pending invitation.")
        : message === "USER_NOT_FOUND"
          ? (isFrench ? "Ce compte maker n’est plus disponible." : "This maker account is no longer available.")
          : message === "NOT_FOUND"
            ? (isFrench ? "Seul le propriétaire du projet peut envoyer des invitations." : "Only the project owner can send invitations.")
            : (isFrench ? "L’invitation n’a pas pu être envoyée. Réessayez." : "The invitation could not be sent. Please try again."));
    },
  });
  const cancelInviteMutation = useMutation({
    mutationFn: async (collaborator: ProjectCollaborator) => {
      const response = await fetch(`/api/projects/${projectId}/collaborators/${collaborator.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "invitation_cancel_failed");
      return collaborator;
    },
    onMutate: (collaborator) => {
      const queryKey = ["co-building-project-invites", projectId];
      void queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ collaborators: ProjectCollaborator[] }>(queryKey);
      queryClient.setQueryData<{ collaborators: ProjectCollaborator[] }>(queryKey, (current) => current && ({
        collaborators: current.collaborators.filter((item) => item.userId !== collaborator.userId),
      }));
      setError("");
      setNotice("");
      return { previous };
    },
    onSuccess: (collaborator) => {
      setNotice(isFrench
        ? `Invitation annulée pour ${collaborator.user.name ?? collaborator.user.handle ?? "ce maker"}.`
        : `Invitation to ${collaborator.user.name ?? collaborator.user.handle ?? "this maker"} cancelled.`);
      void queryClient.invalidateQueries({ queryKey: ["co-building-project-invites", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-hub", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["navigation-counts"] });
    },
    onError: (_cause: Error, _collaborator, context) => {
      if (context?.previous) queryClient.setQueryData(["co-building-project-invites", projectId], context.previous);
      setNotice("");
      setError(isFrench ? "Impossible d’annuler l’invitation. Réessayez." : "Could not cancel the invitation. Please try again.");
    },
  });
  const inviteActionPending = inviteMutation.isPending || cancelInviteMutation.isPending;

  const collaborators = collaboratorsQuery.data?.collaborators ?? [];
  const collaboratorByUserId = new Map(collaborators.map((item) => [item.userId, item]));
  const makers = (makersQuery.data?.makers ?? []).filter((maker) => maker.id !== session?.user?.id);

  return (
    <div className="cb-invite-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !inviteActionPending) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cb-invite-title" onKeyDown={(event) => {
        if (event.key === "Escape") {
          if (roleMenuOpen) setRoleMenuOpen(false);
          else if (!inviteActionPending) onClose();
        }
      }} className="cb-invite-modal">
        <header className="cb-invite-header">
          <div className="cb-invite-heading-icon">
            {projectLogoUrl
              ? <img src={projectLogoUrl} alt="" className="h-full w-full rounded-[12px] object-cover" />
              : <UsersRound size={20} aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="cb-invite-eyebrow">{isFrench ? "ÉQUIPE DU PROJET" : "PROJECT TEAM"}</p>
            <h2 id="cb-invite-title">{isFrench ? "Inviter des makers" : "Invite makers"}</h2>
              <p>{isFrench ? "Trouvez des profils et invitez-les à construire ce projet avec vous." : "Find makers and invite them to build this project with you."}</p>
          </div>
          <button type="button" onClick={onClose} disabled={inviteActionPending} aria-label={isFrench ? "Fermer" : "Close"} className="cb-invite-close"><X size={18} aria-hidden="true" /></button>
        </header>

        {!isOwner ? (
          <div className="cb-invite-owner-note" role="status">
            <UsersRound size={18} aria-hidden="true" />
            {isFrench ? "Seul le propriétaire du projet peut envoyer des invitations. Vous pouvez toutefois découvrir les makers disponibles." : "Only the project owner can send invitations. You can still browse available makers."}
          </div>
        ) : (
          <div className="cb-invite-role">
            <span>{isFrench ? "Rôle proposé" : "Role to invite for"}</span>
            <div className="cb-invite-role-select">
              <button type="button" className="cb-invite-role-trigger" aria-haspopup="listbox" aria-expanded={roleMenuOpen} onClick={() => setRoleMenuOpen((open) => !open)}>
                <span className="cb-invite-role-current">
                  <strong>{invitationRoleLabel(role, isFrench)}</strong>
                  <small>{invitationRoleDescription(role, isFrench)}</small>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {roleMenuOpen && <div className="cb-invite-role-menu" role="listbox" aria-label={isFrench ? "Rôle du maker" : "Maker role"}>
                {INVITATION_ROLES.map((item) => <button key={item} type="button" role="option" aria-selected={role === item} className="cb-invite-role-option" onClick={() => {
                  setRole(item);
                  setRoleMenuOpen(false);
                }}>
                  <span><strong>{invitationRoleLabel(item, isFrench)}</strong><small>{invitationRoleDescription(item, isFrench)}</small></span>
                  {role === item && <Check size={15} aria-hidden="true" />}
                </button>)}
              </div>}
            </div>
          </div>
        )}

        <label className="cb-invite-search">
          <Search size={16} aria-hidden="true" />
          <input autoFocus value={search} onChange={(event) => { setSearch(event.target.value); setMakerPage(0); }} placeholder={isFrench ? "Rechercher par nom, pseudo ou profil…" : "Search by name, handle or profile…"} aria-label={isFrench ? "Rechercher des makers" : "Search makers"} />
          {search && <button type="button" onClick={() => setSearch("")} aria-label={isFrench ? "Effacer la recherche" : "Clear search"}><X size={14} aria-hidden="true" /></button>}
        </label>

        {error && <p className="cb-invite-error" role="alert">{error}</p>}
        {notice && <p className="cb-invite-success" role="status"><Check size={15} aria-hidden="true" />{notice}</p>}

        <div className="cb-invite-list" aria-live="polite">
          {search.trim().length === 1 && <p className="cb-invite-empty">{isFrench ? "Saisissez au moins 2 caractères pour lancer la recherche." : "Enter at least 2 characters to search."}</p>}
          {makersQuery.isLoading && <div className="cb-invite-loading"><LoaderCircle size={19} className="animate-spin" aria-hidden="true" />{isFrench ? "Chargement des makers…" : "Loading makers…"}</div>}
          {makersQuery.isError && <p role="alert" className="cb-invite-empty">{isFrench ? "Impossible de charger les makers. Vérifiez votre connexion et réessayez." : "Could not load makers. Check your connection and try again."}<button type="button" onClick={() => void makersQuery.refetch()}>{isFrench ? "Réessayer" : "Retry"}</button></p>}
          {collaboratorsQuery.isLoading && isOwner && <div className="cb-invite-loading"><LoaderCircle size={19} className="animate-spin" aria-hidden="true" /></div>}
          {collaboratorsQuery.isError && isOwner && <p role="alert" className="cb-invite-empty">{isFrench ? "Impossible de charger les invitations existantes." : "Could not load existing invitations."}<button type="button" onClick={() => void collaboratorsQuery.refetch()}>{isFrench ? "Réessayer" : "Retry"}</button></p>}
          {!makersQuery.isLoading && !makersQuery.isError && search.trim().length !== 1 && makers.map((maker) => {
            const existing = collaboratorByUserId.get(maker.id);
            return (
              <article key={maker.id} className="cb-invite-maker">
                <ProfileAvatar src={maker.image} name={maker.name ?? maker.handle} size={42} online={maker.isOnline} />
                <div className="cb-invite-maker-info">
                  <div className="cb-invite-maker-name">
                    <span>{maker.name ?? `@${maker.handle}`}</span>
                    {maker.openToCoBuild && <span className="cb-invite-open">{isFrench ? "Ouvert au co-building" : "Open to co-building"}</span>}
                  </div>
                  <p>{maker.handle ? `@${maker.handle}` : maker.headline ?? ""}{maker.headline && maker.handle ? ` · ${maker.headline}` : ""}</p>
                  {maker.skills.length > 0 && <small>{maker.skills.slice(0, 3).join(" · ")}</small>}
                </div>
                {existing?.status === "APPROVED" ? (
                  <span className="cb-invite-member"><Check size={14} aria-hidden="true" />{isFrench ? "Membre" : "Member"}</span>
                ) : existing?.status === "PENDING" && existing.invitedById === session?.user?.id ? (
                  <button type="button" className="cb-invite-cancel" onClick={() => cancelInviteMutation.mutate(existing)} disabled={inviteActionPending} aria-label={isFrench ? `Annuler l’invitation de ${maker.name ?? maker.handle ?? "ce maker"}` : `Cancel invitation to ${maker.name ?? maker.handle ?? "this maker"}`}>
                    {cancelInviteMutation.isPending && cancelInviteMutation.variables?.userId === maker.id
                      ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                      : <X size={14} aria-hidden="true" />}
                    {isFrench ? "Annuler" : "Cancel"}
                  </button>
                ) : existing?.status === "PENDING" ? (
                  <span className="cb-invite-pending">{isFrench ? "En attente" : "Pending"}</span>
                ) : (
                  <button type="button" className="cb-invite-send" onClick={() => inviteMutation.mutate(maker)} disabled={!isOwner || inviteActionPending || collaboratorsQuery.isLoading || Boolean(collaboratorsQuery.isError)}>
                    {inviteMutation.isPending && inviteMutation.variables?.id === maker.id
                      ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                      : <UserPlus size={15} aria-hidden="true" />}
                    {isFrench ? "Inviter" : "Invite"}
                  </button>
                )}
              </article>
            );
          })}
          {!makersQuery.isLoading && !makersQuery.isError && search.trim().length !== 1 && makers.length === 0 && (
            <p className="cb-invite-empty">{isFrench ? "Aucun maker ne correspond à cette recherche." : "No makers match this search."}</p>
          )}
          {!makersQuery.isLoading && !makersQuery.isError && makersQuery.data && (makerPage > 0 || makersQuery.data.hasMore) && <div className="cb-invite-pagination">
            <button type="button" onClick={() => setMakerPage((page) => Math.max(0, page - 1))} disabled={makerPage === 0 || makersQuery.isFetching}>
              {isFrench ? "Précédents" : "Previous"}
            </button>
            <span>{isFrench ? `Page ${makerPage + 1}` : `Page ${makerPage + 1}`}</span>
            <button type="button" onClick={() => setMakerPage((page) => page + 1)} disabled={!makersQuery.data.hasMore || makersQuery.isFetching}>
              {isFrench ? "Suivante" : "Next"}
            </button>
          </div>}
        </div>

        <footer className="cb-invite-footer">
          <span>{isFrench ? "Les personnes invitées recevront une notification." : "Invited makers will receive a notification."}</span>
          <button type="button" onClick={onClose} disabled={inviteActionPending}>{isFrench ? "Terminé" : "Done"}</button>
        </footer>
      </section>
    </div>
  );
}

function invitationRoleLabel(role: InvitationRole, isFrench: boolean): string {
  const french: Record<InvitationRole, string> = {
    CO_BUILDER: "Co-builder",
    DEVELOPER: "Développeur·euse",
    DESIGNER: "Designer",
    PRODUCT: "Produit",
    MARKETER: "Marketing",
  };
  const english: Record<InvitationRole, string> = {
    CO_BUILDER: "Co-builder",
    DEVELOPER: "Developer",
    DESIGNER: "Designer",
    PRODUCT: "Product",
    MARKETER: "Marketer",
  };
  return (isFrench ? french : english)[role];
}

function invitationRoleDescription(role: InvitationRole, isFrench: boolean): string {
  const french: Record<InvitationRole, string> = {
    CO_BUILDER: "Participe à la construction du projet",
    DEVELOPER: "Conçoit et développe les fonctionnalités",
    DESIGNER: "Imagine l’expérience et l’interface",
    PRODUCT: "Structure la vision et les priorités",
    MARKETER: "Développe la visibilité du projet",
  };
  const english: Record<InvitationRole, string> = {
    CO_BUILDER: "Helps build the project",
    DEVELOPER: "Designs and develops features",
    DESIGNER: "Shapes the product experience",
    PRODUCT: "Guides product vision and priorities",
    MARKETER: "Grows the project’s reach",
  };
  return (isFrench ? french : english)[role];
}

/* ── tableau de tâches ───────────────────────────────────────────────────── */

function Board({ replica, me }: { replica: Replica; me: CoUser }) {
  const tasks = useMemo(() => replica.liveTasks(), [replica, replica.taskV]); // eslint-disable-line react-hooks/exhaustive-deps
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState("");
  const order = LANES.map((l) => l.id);

  const move = (t: Task, dir: -1 | 1) => {
    const next = order[order.indexOf(t.status) + dir];
    if (next) replica.patchTask(t.id, { status: next });
  };

  return (
    <aside className="cb-panel cb-board" aria-label="Tâches">
      <h3>Tâches</h3>
      <form
        className="cb-add"
        onSubmit={(e) => { e.preventDefault(); replica.addTask(draft); setDraft(""); }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nouvelle tâche" aria-label="Nouvelle tâche" maxLength={120} />
        <button className="cb-btn" type="submit" disabled={!draft.trim()}>Ajouter</button>
      </form>
      <div className="cb-lanes">
        {LANES.map((lane) => {
          const items = tasks.filter((t) => t.status === lane.id);
          return (
            <section
              key={lane.id}
              className={"cb-lane" + (over === lane.id ? " cb-over" : "")}
              onDragOver={(e) => { e.preventDefault(); setOver(lane.id); }}
              onDragLeave={() => setOver((o) => (o === lane.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                const t = replica.tasks.get(id);
                if (t && t.status !== lane.id) replica.patchTask(id, { status: lane.id });
              }}
            >
              <h4>{lane.label} <span>{items.length}</span></h4>
              {items.length === 0 && <p className="cb-empty">Glissez une tâche ici</p>}
              {items.map((t) => (
                <article
                  key={t.id}
                  className="cb-card"
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}
                >
                  <p>{t.title}</p>
                  <footer>
                    <button
                      className={"cb-chip" + (t.assignee ? " cb-chip-on" : "")}
                      style={t.assignee ? { borderColor: t.assignee.color, color: t.assignee.color } : undefined}
                      onClick={() => replica.patchTask(t.id, { assignee: t.assignee?.id === me.id ? null : { id: me.id, name: me.name, color: me.color } })}
                      title={t.assignee?.id === me.id ? "Se retirer de la tâche" : "Prendre cette tâche"}
                    >
                      {t.assignee ? t.assignee.name : "Je prends"}
                    </button>
                    <span className="cb-move">
                      <button className="cb-icon" disabled={t.status === "todo"} onClick={() => move(t, -1)} aria-label="Déplacer vers la colonne précédente">‹</button>
                      <button className="cb-icon" disabled={t.status === "done"} onClick={() => move(t, 1)} aria-label="Déplacer vers la colonne suivante">›</button>
                      <button className="cb-icon" onClick={() => replica.patchTask(t.id, { deleted: true })} aria-label="Supprimer la tâche">×</button>
                    </span>
                  </footer>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

/* ── éditeur de code partagé ─────────────────────────────────────────────── */

function Editor({ replica, projectTitle, connectionState, isFrench, githubUrl }: { replica: Replica; projectTitle: string; connectionState: LinkState; isFrench: boolean; githubUrl?: string }) {
  const [isLightTheme, setIsLightTheme] = useState(false);
  const files = replica.files();
  const [githubTargetUrl, setGithubTargetUrl] = useState(githubUrl ?? "");
  const githubRepository = getGitHubRepository(githubTargetUrl);
  const [file, setFile] = useState<string>(() => files[0] ?? "notes.md");
  const [openFiles, setOpenFiles] = useState<string[]>(() => files[0] ? [files[0]] : []);
  const [quickOpen, setQuickOpen] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [uploadError, setUploadError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [diagnosticsByFile, setDiagnosticsByFile] = useState<Record<string, MonacoEditorApi.IMarker[]>>({});
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [savedContents, setSavedContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(replica.files().map((path) => [path, replica.text(path)])));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [githubPushOpen, setGithubPushOpen] = useState(false);
  const [githubToken, setGithubToken] = useState(() => getGitSessionToken());
  const [githubBranches, setGithubBranches] = useState<string[]>([]);
  const [githubBranch, setGithubBranch] = useState("");
  const [githubCommitMessage, setGithubCommitMessage] = useState("");
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubError, setGithubError] = useState("");
  const [githubStatus, setGithubStatus] = useState("");
  const baselineLoadedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MonacoEditorApi.IStandaloneCodeEditor | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSaveRef = useRef<{ id: string; snapshot: Record<string, string> } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsLightTheme(root.dataset.theme === "light");
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const text = useMemo(() => replica.text(file), [replica, replica.docV, file]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentContents = Object.fromEntries(files.map((path) => [path, replica.text(path)]));
  const dirtyPaths = new Set([
    ...files.filter((path) => !Object.prototype.hasOwnProperty.call(savedContents, path) || savedContents[path] !== currentContents[path]),
    ...Object.keys(savedContents).filter((path) => !files.includes(path)),
  ]);
  const hasUnsavedChanges = dirtyPaths.size > 0;
  const diagnostics = diagnosticsByFile[file] ?? [];
  const errorCount = diagnostics.filter((marker) => marker.severity === 8).length;
  const warningCount = diagnostics.filter((marker) => marker.severity === 4).length;
  const typingPeers = [...replica.peers.values()].filter((peer) => peer.typing && peer.file === file);
  const typingNames = typingPeers.slice(0, 2).map((peer) => peer.user.name);
  const typingMessage = typingPeers.length === 1
    ? (isFrench ? `${typingNames[0]} écrit…` : `${typingNames[0]} is typing…`)
    : isFrench
      ? `${typingNames.join(", ")}${typingPeers.length > 2 ? ` et ${typingPeers.length - 2} autre(s)` : ""} écrivent…`
      : `${typingNames.join(", ")}${typingPeers.length > 2 ? ` and ${typingPeers.length - 2} more` : ""} are typing…`;
  const searchResults = useMemo(() => {
    const query = fileQuery.trim().toLocaleLowerCase();
    if (!query) return files.slice(0, 40);
    return files.filter((path) =>
      path.toLocaleLowerCase().includes(query) ||
      replica.text(path).toLocaleLowerCase().includes(query),
    ).slice(0, 40);
  }, [fileQuery, files, replica]);
  const openFile = (path: string) => {
    setFile(path);
    setOpenFiles((current) => current.includes(path) ? current : [...current, path]);
  };
  const selectQuickOpenFile = (path: string) => {
    openFile(path);
    setQuickOpen(false);
    setFileQuery("");
  };
  const downloadCurrentFile = () => downloadText(file, text, "text/plain;charset=utf-8");
  const loadGitHubBranches = async () => {
    if (!githubRepository || !githubToken.trim()) {
      setGithubError(!githubRepository
        ? (isFrench ? "Saisissez une URL de dépôt GitHub valide." : "Enter a valid GitHub repository URL.")
        : (isFrench ? "Saisissez un jeton GitHub avec accès en écriture au dépôt." : "Enter a GitHub token with write access to this repository."));
      return;
    }
    setGithubBusy(true);
    setGithubError("");
    setGithubStatus("");
    try {
      const result = await connectGit("github", githubToken.trim(), githubRepository);
      setGithubBranches(result.branches.map((branch) => branch.name));
      setGithubBranch(result.defaultBranch);
      setGitSessionToken(githubToken.trim());
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : (isFrench ? "Impossible de charger les branches GitHub." : "Unable to load GitHub branches."));
      setGithubBranches([]);
      setGithubBranch("");
    } finally {
      setGithubBusy(false);
    }
  };
  const pushToGitHub = async () => {
    if (!githubRepository) {
      setGithubError(isFrench ? "Saisissez une URL de dépôt GitHub valide." : "Enter a valid GitHub repository URL.");
      return;
    }
    if (!githubBranch || !githubCommitMessage.trim()) return;
    if (!window.confirm(isFrench
      ? `Pousser les fichiers de l’espace partagé vers ${githubRepository} (${githubBranch}) ? Les autres fichiers du dépôt seront conservés.`
      : `Push the shared workspace files to ${githubRepository} (${githubBranch})? Other repository files will be preserved.`)) return;
    setGithubBusy(true);
    setGithubError("");
    setGithubStatus("");
    try {
      const workspaceFiles = replica.files().map((path) => ({ path, content: replica.text(path) }));
      const sha = await pushGitHubChanges(
        githubToken.trim(),
        githubRepository,
        githubBranch,
        githubCommitMessage.trim(),
        workspaceFiles,
      );
      setGithubCommitMessage("");
      setGithubStatus(isFrench
        ? `Commit ${sha.slice(0, 12)} poussé sur ${githubBranch}.`
        : `Commit ${sha.slice(0, 12)} pushed to ${githubBranch}.`);
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : (isFrench ? "Échec du push GitHub." : "GitHub push failed."));
    } finally {
      setGithubBusy(false);
    }
  };
  const saveWorkspaceChanges = useCallback(() => {
    if (!hasUnsavedChanges || saving) return;
    if (connectionState !== "online") {
      setSaveError(isFrench ? "Connexion requise pour enregistrer." : "A connection is required to save.");
      return;
    }

    const id = uid();
    const snapshot = Object.fromEntries(replica.files().map((path) => [path, replica.text(path)]));
    pendingSaveRef.current = { id, snapshot };
    replica.sendSaveRequest(id);
    setSaving(true);
    setSaveError("");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingSaveRef.current?.id !== id) return;
      pendingSaveRef.current = null;
      setSaving(false);
      setSaveError(isFrench ? "La sauvegarde n’a pas reçu de confirmation." : "The save was not confirmed.");
    }, 15_000);
  }, [connectionState, hasUnsavedChanges, isFrench, replica, saving]);
  const downloadWorkspace = () => {
    const workspaceName = safeDownloadName(projectTitle);
    const vscodeWorkspace = JSON.stringify({ folders: [{ path: "." }] }, null, 2);
    const archive = createProjectArchive([
      ...files.map((path) => ({ path, content: replica.text(path) })),
      { path: `${workspaceName}.code-workspace`, content: vscodeWorkspace },
    ]);
    downloadText(`${safeDownloadName(projectTitle)}.zip`, archive, "application/zip");
  };
  const closeFile = (path: string) => {
    const next = openFiles.filter((item) => item !== path);
    if (!next.length && files.length) next.push(files.find((item) => item !== path) ?? files[0]);
    if (file === path && next[0]) {
      const currentIndex = openFiles.indexOf(path);
      setFile(next[Math.min(currentIndex, next.length - 1)]);
    }
    setOpenFiles(next);
  };

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        setQuickOpen(true);
      } else if (key === "s") {
        event.preventDefault();
        saveWorkspaceChanges();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [file, replica, saveWorkspaceChanges]);

  useEffect(() => {
    const result = replica.saveResult;
    const pending = pendingSaveRef.current;
    if (!result || !pending || result.id !== pending.id) return;
    clearTimeout(saveTimeoutRef.current);
    pendingSaveRef.current = null;
    setSaving(false);
    if (result.success) {
      setSavedContents(pending.snapshot);
      setSaveError("");
    } else {
      setSaveError(isFrench ? "Échec de l’enregistrement côté serveur." : "The server could not save these changes.");
    }
  }, [isFrench, replica, replica.saveResult]);

  useEffect(() => {
    if (!replica.initialStateLoaded || baselineLoadedRef.current) return;
    baselineLoadedRef.current = true;
    const snapshot = Object.fromEntries(replica.files().map((path) => [path, replica.text(path)]));
    setSavedContents((previous) => {
      const baseline = { ...snapshot };
      for (const path of replica.locallyModifiedFiles) {
        if (Object.prototype.hasOwnProperty.call(previous, path)) baseline[path] = previous[path];
        else delete baseline[path];
      }
      return baseline;
    });
  }, [replica, replica.initialStateLoaded, replica.docV]);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  useEffect(() => {
    setDiagnosticsOpen(false);
  }, [file]);

  useEffect(() => { replica.setLocal({ file }); }, [file, replica]);
  useEffect(() => { folderInputRef.current?.setAttribute("webkitdirectory", ""); }, []);

  const commit = (value: string | undefined) => {
    if (value === undefined) return;
    replica.setText(file, value);
    replica.setLocal({ typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => replica.setLocal({ typing: false }), 1500);
  };

  const onUpload = async (selected: FileList | null) => {
    if (!selected?.length) return;
    setBusy(true);
    setUploadError("");
    setUploadNotice("");
    const filesToImport = Array.from(selected);
    const totalBytes = filesToImport.reduce((sum, item) => sum + item.size, 0);
    if (filesToImport.length > 500 || totalBytes > 1_500_000) {
      setUploadError("Import limité à 500 fichiers et 1,5 Mo par sélection. Importez le projet en plusieurs fois.");
      setBusy(false);
      return;
    }

    let imported = 0;
    let replaced = 0;
    let importedLines = 0;
    const errors: string[] = [];
    for (const item of filesToImport) {
      const path = item.webkitRelativePath || item.name;
      if (item.size > 256_000) {
        errors.push(`${path} : fichier supérieur à 256 Ko`);
        continue;
      }
      try {
        const content = new TextDecoder("utf-8", { fatal: true }).decode(await item.arrayBuffer());
        if (content.includes("\0")) {
          errors.push(`${path} : fichier binaire non pris en charge`);
          continue;
        }
        const normalized = normalizeFilePath(path);
        if (!normalized) {
          errors.push(`${path} : chemin invalide ou trop long`);
          continue;
        }
        const lineCount = content.split("\n").length;
        if (lineCount > 20_000 || importedLines + lineCount > 3_000) {
          errors.push(`${path} : limite de lignes de l’import atteinte`);
          continue;
        }
        if (replica.docs.has(normalized)) replaced++;
        if (replica.importFile(normalized, content)) {
          imported++;
          importedLines += lineCount;
          openFile(normalized);
          setExpanded((current) => {
            const next = new Set(current);
            const segments = normalized.split("/");
            for (let index = 1; index < segments.length; index++) next.add(segments.slice(0, index).join("/"));
            return next;
          });
        } else {
          errors.push(`${path} : import impossible`);
        }
      } catch {
        errors.push(`${path} : lecture impossible (UTF-8 requis)`);
      }
    }
    setUploadNotice(`${imported} fichier(s) importé(s)${replaced ? `, ${replaced} remplacé(s)` : ""}.`);
    if (errors.length) setUploadError(errors.slice(0, 4).join(" · ") + (errors.length > 4 ? ` · et ${errors.length - 4} autre(s)` : ""));
    setBusy(false);
  };

  const tree = buildFileTree(files);

  return (
    <div className="cb-workspace">
      <aside className="cb-explorer" aria-label="Explorateur de fichiers">
        <div className="cb-explorer-head">
          <div className="cb-explorer-title">
            <ChevronDown size={13} aria-hidden="true" />
            <h3>Explorateur</h3>
          </div>
          <div className="cb-explorer-toolbar">
            <button type="button" className="cb-explorer-action" onClick={() => setQuickOpen(true)} title="Rechercher un fichier (Ctrl+P)" aria-label="Rechercher un fichier">
              <Search size={15} aria-hidden="true" />
            </button>
            <button type="button" className="cb-explorer-action" onClick={downloadWorkspace} title="Télécharger le ZIP, l’extraire puis ouvrir le fichier .code-workspace dans VS Code" aria-label="Télécharger pour VS Code">
              <Archive size={15} aria-hidden="true" />
            </button>
            <button type="button" className="cb-explorer-action" onClick={() => setAdding((current) => !current)} title="Nouveau fichier" aria-label="Nouveau fichier">
              <FilePlus2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="cb-project-root"><ChevronDown size={13} aria-hidden="true" /> {projectTitle}</p>
        <div className="cb-explorer-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><Upload size={14} aria-hidden="true" /> Fichiers</button>
          <button type="button" onClick={() => folderInputRef.current?.click()} disabled={busy}><FolderUp size={14} aria-hidden="true" /> Dossier</button>
          <input ref={fileInputRef} className="cb-hidden-input" type="file" multiple onChange={(event) => { void onUpload(event.currentTarget.files); event.currentTarget.value = ""; }} />
          <input ref={folderInputRef} className="cb-hidden-input" type="file" multiple onChange={(event) => { void onUpload(event.currentTarget.files); event.currentTarget.value = ""; }} />
        </div>
        {adding && <form className="cb-create-file" onSubmit={(event) => {
          event.preventDefault();
          const created = replica.createFile(newName);
          if (created) {
            openFile(created);
            const segments = created.split("/");
            setExpanded((current) => {
              const next = new Set(current);
              for (let index = 1; index < segments.length; index++) next.add(segments.slice(0, index).join("/"));
              return next;
            });
          }
          else setUploadError("Nom de fichier invalide (chemin relatif de 128 caractères maximum).");
          setNewName("");
          setAdding(false);
        }}>
          <input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="src/app.ts" aria-label="Chemin du nouveau fichier" />
          <button type="submit" aria-label="Créer le fichier"><Plus size={14} /></button>
        </form>}
        {uploadNotice && <p className="cb-upload-notice" role="status">{uploadNotice}</p>}
        {uploadError && <p className="cb-upload-error" role="alert">{uploadError}</p>}
        <div className="cb-file-tree">
          {tree.map((node) => <FileTreeEntry key={node.path} node={node} depth={0} activeFile={file} expanded={expanded} onDelete={(path) => {
            replica.deletePath(path);
            const isDeleted = (item: string) => item === path || item.startsWith(`${path}/`);
            setOpenFiles((current) => current.filter((item) => !isDeleted(item)));
            if (isDeleted(file)) {
              const nextFile = files.find((item) => !isDeleted(item));
              setFile(nextFile ?? "");
            }
          }} onToggle={(path) => setExpanded((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
          })} onSelect={openFile} />)}
        </div>
        {!tree.length && <p className="cb-tree-empty">Importez un dossier ou créez un fichier pour commencer.</p>}
      </aside>
      <main className="cb-panel cb-editor">
        <div className="cb-tabs" role="tablist" aria-label="Fichiers ouverts">
          {openFiles.map((path) => (
            <div key={path} className={"cb-tab-group" + (path === file ? " cb-tab-group-on" : "")} role="presentation">
              <button type="button" role="tab" aria-selected={path === file} className="cb-tab" title={path} onClick={() => openFile(path)}>
                <FileIconBadge file={projectFileForIcon(path)} className="cb-file-icon" />
                <span>{path.split("/").pop()}</span>
                {dirtyPaths.has(path) && <i className="cb-tab-dirty" aria-label={isFrench ? "Modifications non enregistrées" : "Unsaved changes"} title={isFrench ? "Modifications non enregistrées" : "Unsaved changes"} />}
              </button>
              <button type="button" className="cb-tab-close" onClick={() => closeFile(path)} aria-label={`Fermer ${path}`}>
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
          <span className="cb-here">
            {[...replica.peers.values()].filter((peer) => peer.file === file).map((peer) => (
              <Avatar key={peer.user.id} u={peer.user} typing={peer.typing} size={20} />
            ))}
          </span>
          <button type="button" className="cb-github-push" onClick={() => {
            setGithubToken(getGitSessionToken());
            setGithubError("");
            setGithubStatus("");
            setGithubPushOpen(true);
          }} title={githubRepository ? (isFrench ? `Pousser vers ${githubRepository}` : `Push to ${githubRepository}`) : (isFrench ? "Configurer le dépôt GitHub pour le push" : "Configure the GitHub repository for pushing")} aria-label={isFrench ? "Pousser vers GitHub" : "Push to GitHub"}>
            <Github size={15} aria-hidden="true" />
          </button>
          <button type="button" className="cb-editor-save" onClick={saveWorkspaceChanges} disabled={!hasUnsavedChanges || saving} title={isFrench ? "Enregistrer les modifications (Ctrl+S)" : "Save changes (Ctrl+S)"} aria-label={isFrench ? "Enregistrer les modifications" : "Save changes"}>
            <Save size={15} aria-hidden="true" />
          </button>
          <button type="button" className="cb-editor-download" onClick={downloadCurrentFile} title={isFrench ? "Télécharger ce fichier" : "Download this file"} aria-label={isFrench ? "Télécharger ce fichier" : "Download this file"}>
            <Download size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="cb-breadcrumbs" aria-label="Chemin du fichier">
          {file.split("/").map((part, index) => (
            <React.Fragment key={`${part}-${index}`}>
              {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </div>
        {typingPeers.length > 0 && <div className="cb-live-typing" role="status" aria-live="polite">
          <span className="cb-live-typing-avatars">
            {typingPeers.slice(0, 3).map((peer) => <Avatar key={peer.user.id} u={peer.user} typing size={19} />)}
          </span>
          <span>{typingMessage}</span>
        </div>}
        <div className="cb-code">
          <MonacoEditor
            height="100%"
            path={file || undefined}
            language={editorLanguage(file)}
            theme={isLightTheme ? "vs" : "vs-dark"}
            value={text}
            onChange={commit}
            onValidate={(markers) => setDiagnosticsByFile((current) => ({
              ...current,
              [file]: markers.filter((marker) => marker.severity === 8 || marker.severity === 4),
            }))}
            beforeMount={(monaco) => {
              monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: true,
              });
              monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: true,
              });
              monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
                allowNonTsExtensions: true,
              });
              monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
                allowNonTsExtensions: true,
              });
            }}
            onMount={(editor) => {
              editorRef.current = editor;
              editor.onDidChangeCursorPosition(({ position }) => {
                replica.setLocal({ line: position.lineNumber - 1 });
                setCursor({ line: position.lineNumber, column: position.column });
              });
              editor.onDidBlurEditorWidget(() => replica.setLocal({ line: undefined, typing: false }));
            }}
            options={{
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
        {diagnosticsOpen && <section className="cb-diagnostics-popover" aria-label={isFrench ? "Problèmes du fichier" : "File problems"}>
          <header>
            <strong>{isFrench ? "Problèmes" : "Problems"}</strong>
            <button type="button" onClick={() => setDiagnosticsOpen(false)} aria-label={isFrench ? "Fermer les problèmes" : "Close problems"}><X size={14} /></button>
          </header>
          {!diagnostics.length ? <p className="cb-diagnostics-empty">{isFrench ? "Aucune erreur ni aucun avertissement dans ce fichier." : "No errors or warnings in this file."}</p>
            : <ul>{diagnostics.map((marker, index) => (
              <li key={`${marker.startLineNumber}-${marker.startColumn}-${index}`}>
                <button type="button" onClick={() => {
                  editorRef.current?.revealLineInCenter(marker.startLineNumber);
                  editorRef.current?.setPosition({ lineNumber: marker.startLineNumber, column: marker.startColumn });
                  editorRef.current?.focus();
                  setDiagnosticsOpen(false);
                }}>
                  <span className={marker.severity === 8 ? "cb-diagnostic-error" : "cb-diagnostic-warning"}>{marker.severity === 8 ? (isFrench ? "Erreur" : "Error") : (isFrench ? "Avertissement" : "Warning")}</span>
                  <span className="cb-diagnostic-message">{marker.message}</span>
                  <small>{isFrench ? "Ligne" : "Line"} {marker.startLineNumber}:{marker.startColumn}</small>
                </button>
              </li>
            ))}</ul>}
        </section>}
        <footer className="cb-statusbar" aria-label="État du fichier">
          <span className={"cb-status-connection cb-status-" + connectionState}><i />{connectionState === "online" ? "Synchronisé" : connectionState === "connecting" ? "Connexion…" : "Hors ligne"}</span>
          <span className={`cb-save-indicator${saveError ? " cb-save-error" : hasUnsavedChanges ? " cb-save-dirty" : ""}`} role="status" aria-live="polite">
            <i aria-hidden="true" />
            {saving ? (isFrench ? "Enregistrement…" : "Saving…")
              : saveError || (hasUnsavedChanges
                ? (isFrench ? "Modifications non enregistrées" : "Unsaved changes")
                : (isFrench ? "Enregistré" : "Saved"))}
          </span>
          <button type="button" className={`cb-diagnostics-badge${errorCount ? " cb-diagnostics-errors" : warningCount ? " cb-diagnostics-warnings" : ""}`} onClick={() => setDiagnosticsOpen((open) => !open)} aria-expanded={diagnosticsOpen} aria-label={isFrench ? `${errorCount} erreur(s), ${warningCount} avertissement(s)` : `${errorCount} error(s), ${warningCount} warning(s)`}>
            <i aria-hidden="true" />{errorCount
              ? `${errorCount} ${isFrench ? "erreur(s)" : "error(s)"}${warningCount ? ` · ${warningCount} ${isFrench ? "avertissement(s)" : "warning(s)"}` : ""}`
              : warningCount
                ? `${warningCount} ${isFrench ? "avertissement(s)" : "warning(s)"}`
                : isFrench ? "Aucun problème" : "No problems"}
          </button>
          <span className="cb-status-spacer" />
          <span>Ln {cursor.line}, Col {cursor.column}</span>
          <span>{text.split("\n").length} lignes</span>
          <span>{editorLanguage(file)}</span>
          <span>UTF-8</span>
          <span><Code2 size={13} aria-hidden="true" /> Co-building</span>
        </footer>
      </main>
      {githubPushOpen && <div className="cb-github-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !githubBusy) setGithubPushOpen(false);
      }}>
        <section className="cb-github-modal" role="dialog" aria-modal="true" aria-labelledby="cb-github-title" onKeyDown={(event) => {
          if (event.key === "Escape" && !githubBusy) setGithubPushOpen(false);
        }}>
          <header>
            <div className="cb-github-icon"><Github size={19} aria-hidden="true" /></div>
            <div className="cb-github-heading">
              <h2 id="cb-github-title">{isFrench ? "Pousser vers GitHub" : "Push to GitHub"}</h2>
              {githubRepository
                ? <a href={`https://github.com/${githubRepository}`} target="_blank" rel="noreferrer">{githubRepository}</a>
                : <span>{isFrench ? "Dépôt à configurer" : "Repository not configured"}</span>}
            </div>
            <button type="button" onClick={() => setGithubPushOpen(false)} disabled={githubBusy} aria-label={isFrench ? "Fermer" : "Close"}><X size={16} aria-hidden="true" /></button>
          </header>
          <div className="cb-github-form">
            <label>
              <span>{isFrench ? "URL du dépôt lié au projet" : "Project GitHub repository URL"}</span>
              <input type="url" value={githubTargetUrl} onChange={(event) => {
                setGithubTargetUrl(event.target.value);
                setGithubBranches([]);
                setGithubBranch("");
                setGithubError("");
                setGithubStatus("");
              }} placeholder="https://github.com/owner/repository" />
            </label>
            <label>
              <span>{isFrench ? "Jeton d’accès personnel GitHub" : "GitHub personal access token"}</span>
              <input type="password" autoComplete="off" value={githubToken} onChange={(event) => {
                const token = event.target.value;
                setGithubToken(token);
                setGitSessionToken(token);
                setGithubBranches([]);
                setGithubBranch("");
                setGithubError("");
              }} placeholder="github_pat_…" />
            </label>
            <p className="cb-github-help">
              {isFrench
                ? "Utilisez un jeton limité à ce dépôt avec l’autorisation Contents: Read and write. Il reste en mémoire et n’est pas enregistré par LynoraLink."
                : "Use a token limited to this repository with Contents: Read and write permission. It stays in memory and is not saved by LynoraLink."}
            </p>
            <button type="button" className="cb-github-secondary" onClick={() => void loadGitHubBranches()} disabled={githubBusy || !githubToken.trim()}>
              {githubBusy ? <LoaderCircle size={14} className="cb-spin" aria-hidden="true" /> : <Github size={14} aria-hidden="true" />}
              {isFrench ? "Charger les branches" : "Load branches"}
            </button>
            {githubBranches.length > 0 && <>
              <label>
                <span>{isFrench ? "Branche cible" : "Target branch"}</span>
                <select value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)}>
                  {githubBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                </select>
              </label>
              <label>
                <span>{isFrench ? "Message du commit" : "Commit message"}</span>
                <input value={githubCommitMessage} maxLength={500} onChange={(event) => setGithubCommitMessage(event.target.value)} placeholder={isFrench ? "Décrire les modifications" : "Describe these changes"} />
              </label>
              <p className="cb-github-help">
                {isFrench
                  ? `${files.length} fichier(s) de l’espace seront ajoutés ou mis à jour. Aucun autre fichier du dépôt ne sera supprimé.`
                  : `${files.length} workspace file(s) will be added or updated. No other repository files will be deleted.`}
              </p>
            </>}
            {githubError && <p className="cb-github-error" role="alert">{githubError}</p>}
            {githubStatus && <p className="cb-github-success" role="status">{githubStatus}</p>}
          </div>
          <footer>
            <button type="button" className="cb-github-secondary" onClick={() => setGithubPushOpen(false)} disabled={githubBusy}>{isFrench ? "Annuler" : "Cancel"}</button>
            <button type="button" className="cb-github-primary" onClick={() => void pushToGitHub()} disabled={githubBusy || !githubBranch || !githubCommitMessage.trim()}>
              {githubBusy ? <LoaderCircle size={14} className="cb-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
              {githubBusy ? (isFrench ? "Envoi…" : "Pushing…") : (isFrench ? "Pousser le projet" : "Push project")}
            </button>
          </footer>
        </section>
      </div>}
      {quickOpen && <div className="cb-quick-open-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setQuickOpen(false);
          setFileQuery("");
        }
      }}>
        <section className="cb-quick-open" role="dialog" aria-modal="true" aria-label="Rechercher un fichier">
          <label className="cb-quick-open-input">
            <Search size={16} aria-hidden="true" />
            <input autoFocus value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuickOpen(false);
                setFileQuery("");
              } else if (event.key === "Enter" && searchResults[0]) {
                selectQuickOpenFile(searchResults[0]);
              }
            }} placeholder="Rechercher dans les fichiers du projet…" aria-label="Rechercher dans les fichiers du projet" />
            <kbd>ESC</kbd>
          </label>
          <div className="cb-quick-open-results" role="listbox" aria-label="Résultats">
            {searchResults.map((path) => (
              <button key={path} type="button" role="option" aria-selected={path === file} onClick={() => selectQuickOpenFile(path)}>
                <FileIconBadge file={projectFileForIcon(path)} className="cb-file-icon" />
                <span>{path}</span>
                <small>{path === file ? "Ouvert" : editorLanguage(path)}</small>
              </button>
            ))}
            {!searchResults.length && <p className="cb-quick-open-empty">Aucun fichier correspondant.</p>}
          </div>
          <footer><span><kbd>Ctrl</kbd> + <kbd>P</kbd> ouvrir</span><span>Nom du fichier ou contenu</span></footer>
        </section>
      </div>}
    </div>
  );
}

type FileTreeNode = { name: string; path: string; isFile: boolean; children: FileTreeNode[] };

function buildFileTree(files: string[]): FileTreeNode[] {
  const root: FileTreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const file of files) {
    let children = root.children;
    const segments = file.split("/");
    segments.forEach((name, index) => {
      const path = segments.slice(0, index + 1).join("/");
      let node = children.find((item) => item.name === name);
      if (!node) {
        node = { name, path, isFile: index === segments.length - 1, children: [] };
        children.push(node);
      }
      children = node.children;
    });
  }
  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((left, right) => Number(left.isFile) - Number(right.isFile) || left.name.localeCompare(right.name));
    nodes.forEach((node) => sort(node.children));
  };
  sort(root.children);
  return root.children;
}

function FileTreeEntry({ node, depth, activeFile, expanded, onToggle, onSelect, onDelete }: {
  node: FileTreeNode;
  depth: number;
  activeFile: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const isExpanded = expanded.has(node.path);
  const Icon = isExpanded ? FolderOpen : Folder;
  return (
    <>
      <div
        className={"cb-file-entry" + (node.isFile && node.path === activeFile ? " cb-file-entry-active" : "")}
        style={{ paddingLeft: 9 + depth * 14 }}
      >
        <button
          type="button"
          className="cb-file-select"
          onClick={() => node.isFile ? onSelect(node.path) : onToggle(node.path)}
          aria-expanded={node.isFile ? undefined : isExpanded}
        >
          {node.isFile ? <span className="cb-file-spacer" /> : isExpanded
            ? <ChevronDown size={13} aria-hidden="true" />
            : <ChevronRight size={13} aria-hidden="true" />}
          {node.isFile
            ? <FileIconBadge file={projectFileForIcon(node.path)} className="cb-file-icon" />
            : <Icon size={14} aria-hidden="true" />}
          <span className="cb-file-name">{node.name}</span>
        </button>
        <button type="button" className="cb-file-delete" aria-label={`${node.isFile ? "Supprimer le fichier" : "Supprimer le dossier"} ${node.name}`} title={`${node.isFile ? "Supprimer le fichier" : "Supprimer le dossier"} ${node.name}`} onClick={() => {
          onDelete(node.path);
        }}><Trash2 size={12} aria-hidden="true" /></button>
      </div>
      {!node.isFile && isExpanded && node.children.map((child) => (
        <FileTreeEntry key={child.path} node={child} depth={depth + 1} activeFile={activeFile} expanded={expanded} onToggle={onToggle} onSelect={onSelect} onDelete={onDelete} />
      ))}
    </>
  );
}

function editorLanguage(file: string): string {
  const extension = file.split(".").pop()?.toLowerCase() ?? "";
  const languages: Record<string, string> = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    py: "python", html: "html", htm: "html", css: "css", scss: "scss", less: "less",
    json: "json", jsonc: "json", md: "markdown", mdx: "markdown", yml: "yaml", yaml: "yaml",
    xml: "xml", svg: "xml", sql: "sql", sh: "shell", bash: "shell", zsh: "shell",
    java: "java", cs: "csharp", cpp: "cpp", cc: "cpp", c: "c", h: "c", hpp: "cpp",
    go: "go", rs: "rust", php: "php", rb: "ruby", swift: "swift", kt: "kotlin",
    dart: "dart", vue: "html", svelte: "html", toml: "ini", ini: "ini",
    dockerfile: "dockerfile", makefile: "makefile", graphql: "graphql", gql: "graphql",
  };
  return languages[extension] ?? "plaintext";
}

function projectFileForIcon(path: string): ProjectFile {
  const name = path.split("/").pop() ?? path;
  const extension = name.toLowerCase().split(".").pop() ?? "";
  const type = isProjectFileType(extension) ? extension : "unknown";
  return { id: path, name, path, type, isDirectory: false, updatedAt: 0 };
}

function isProjectFileType(value: string): value is ProjectFile["type"] {
  return [
    "js", "ts", "tsx", "jsx", "py", "java", "cs", "go", "rust", "c", "cpp",
    "json", "md", "html", "css", "scss", "yml", "yaml", "sh", "sql", "xml",
    "txt", "env", "prisma", "toml", "dockerfile", "unknown",
  ].includes(value);
}

function safeDownloadName(value: string): string {
  const name = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return name || "co-building-project";
}

function downloadText(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/* ── discussion ──────────────────────────────────────────────────────────── */

function Chat({ replica, me, isFrench }: { replica: Replica; me: CoUser; isFrench: boolean }) {
  const msgs = useMemo(() => [...replica.chat.values()].sort((a, b) => a.at - b.at), [replica, replica.chatV]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<Id | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  return (
    <aside className="cb-panel cb-chat" aria-label={isFrench ? "Discussion" : "Discussion"}>
      <h3>{isFrench ? "Discussion" : "Discussion"}</h3>
      <div className="cb-log" role="log" aria-live="polite">
        {msgs.length === 0 && <p className="cb-empty">{isFrench ? "Écrivez le premier message à l’équipe." : "Write the first message to your team."}</p>}
        {msgs.map((m) => {
          if (m.local) return <p key={m.id} className="cb-notice">{m.text}</p>;
          const author = m.from.id === me.id ? me : replica.peers.get(m.from.id)?.user ?? m.from;
          const repliedMessage = m.replyTo ? replica.chat.get(m.replyTo) : undefined;
          const time = new Intl.DateTimeFormat(isFrench ? "fr-FR" : "en-US", { dateStyle: "short", timeStyle: "short" }).format(m.at);
          return (
            <article key={m.id} className={"cb-msg" + (m.from.id === me.id ? " cb-msg-me" : "")}>
              <Avatar u={author} size={22} />
              <div className="cb-msg-content">
                <div className="cb-msg-meta">
                  <b style={{ color: m.from.color }}>{m.from.id === me.id ? (isFrench ? "Vous" : "You") : m.from.name}</b>
                  <time dateTime={new Date(m.at).toISOString()}>{time}</time>
                  {!m.deleted && (
                    <span className="cb-msg-actions">
                      <button type="button" onClick={() => setReplyingTo(m.id)} aria-label={isFrench ? "Répondre à ce message" : "Reply to this message"} title={isFrench ? "Répondre" : "Reply"}>
                        {isFrench ? "Répondre" : "Reply"}
                      </button>
                      {m.from.id === me.id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(isFrench ? "Supprimer ce message ?" : "Delete this message?")) replica.deleteChatMessage(m.id);
                          }}
                          aria-label={isFrench ? "Supprimer ce message" : "Delete this message"}
                          title={isFrench ? "Supprimer" : "Delete"}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
                {m.replyTo && (
                  <div className="cb-msg-quote">
                    <b>{repliedMessage?.from.id === me.id ? (isFrench ? "Vous" : "You") : repliedMessage?.from.name ?? (isFrench ? "Message" : "Message")}</b>
                    <span>{repliedMessage?.deleted
                      ? (isFrench ? "Message supprimé" : "Message deleted")
                      : repliedMessage?.text ?? (isFrench ? "Message indisponible" : "Message unavailable")}</span>
                  </div>
                )}
                <p className={m.deleted ? "cb-msg-deleted" : undefined}>
                  {m.deleted ? (isFrench ? "Ce message a été supprimé." : "This message was deleted.") : m.text}
                </p>
                {replica.failedChatDeletes.has(m.id) && <span className="cb-msg-error" role="alert">{isFrench ? "Impossible de supprimer ce message. Réessayez." : "Could not delete this message. Please try again."}</span>}
              </div>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="cb-add" onSubmit={(e) => { e.preventDefault(); replica.say(draft, replyingTo ?? undefined); setDraft(""); setReplyingTo(null); }}>
        {replyingTo && (
          <div className="cb-reply-composer">
            <span>{isFrench ? "Réponse à" : "Replying to"} <b>{replica.chat.get(replyingTo)?.from.name ?? (isFrench ? "ce message" : "this message")}</b></span>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label={isFrench ? "Annuler la réponse" : "Cancel reply"}><X size={13} aria-hidden="true" /></button>
          </div>
        )}
        <div className="cb-add-row">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={isFrench ? "Votre message" : "Your message"} aria-label={isFrench ? "Votre message" : "Your message"} maxLength={1000} />
          <button className="cb-btn cb-btn-main" type="submit" disabled={!draft.trim()}>{isFrench ? "Envoyer" : "Send"}</button>
        </div>
      </form>
    </aside>
  );
}

function ActivityHistory({ replica, isFrench }: { replica: Replica; isFrench: boolean }) {
  const history = [...replica.history].reverse();
  const actionLabels: Record<ActivityAction, string> = isFrench ? {
    file_created: "a créé le fichier",
    file_imported: "a importé le fichier",
    file_modified: "a modifié le fichier",
    file_deleted: "a supprimé le fichier",
    task_created: "a créé la tâche",
    task_updated: "a mis à jour la tâche",
    task_deleted: "a supprimé la tâche",
  } : {
    file_created: "created the file",
    file_imported: "imported the file",
    file_modified: "edited the file",
    file_deleted: "deleted the file",
    task_created: "created the task",
    task_updated: "updated the task",
    task_deleted: "deleted the task",
  };
  const dateFormatter = new Intl.DateTimeFormat(isFrench ? "fr-FR" : "en-US", { dateStyle: "short", timeStyle: "short" });

  return (
    <aside className="cb-panel cb-activity" aria-label={isFrench ? "Historique des activités" : "Activity history"}>
      <h3>{isFrench ? "Historique des activités" : "Activity history"}</h3>
      <div className="cb-activity-list" role="log" aria-live="polite">
        {!history.length && <p className="cb-empty">{isFrench ? "Les actions du projet apparaîtront ici." : "Project activity will appear here."}</p>}
        {history.map((event) => (
          <article className="cb-activity-entry" key={event.id}>
            <Avatar u={event.actor.id === replica.me.id ? replica.me : replica.peers.get(event.actor.id)?.user ?? event.actor} size={24} />
            <div className="cb-activity-copy">
              <p><b>{event.actor.id === replica.me.id ? (isFrench ? "Vous" : "You") : event.actor.name}</b> {actionLabels[event.action]} <code>{event.target}</code></p>
              <time dateTime={new Date(event.at).toISOString()}>{dateFormatter.format(event.at)}</time>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

/* ── curseurs distants ───────────────────────────────────────────────────── */

function Cursors({ replica }: { replica: Replica }) {
  useSyncExternalStore(replica.subscribeCursors, replica.cursorSnapshot, replica.cursorSnapshot);
  return (
    <div className="cb-cursors" aria-hidden="true">
      {[...replica.cursors].map(([id, c]) => {
        const p = replica.peers.get(id);
        if (!p) return null;
        return (
          <div key={id} className="cb-cursor" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 1l5.5 14 2.2-5.3L14 7.5z" fill={p.user.color} stroke="#04161c" strokeWidth="1" /></svg>
            <span style={{ background: p.user.color }}>{p.user.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════ Styles ══════════════════════════════════ */

const CSS = `
.cb{--surface:rgb(var(--midnight-deep));--panel:rgb(var(--card));--raise:rgb(var(--midnight));--line:rgb(var(--midnight-border));--glow:rgb(var(--brand-accent));--violet:rgb(var(--brand-glow));--amber:#ffc857;--text:rgb(var(--ink));--muted:rgb(var(--ink-muted));
 position:relative;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;width:100%;height:100%;min-height:0;padding:0;
 background:radial-gradient(1200px 520px at 85% -10%,rgb(var(--brand-glow) / .16),transparent 60%),radial-gradient(900px 500px at -5% 110%,rgb(var(--brand-accent) / .08),transparent 60%),var(--surface);
 color:var(--text);font:14px/1.45 "Inter Tight",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border-radius:0;overflow:hidden}
.cb *{box-sizing:border-box}
.cb h2,.cb h3,.cb h4,.cb p{margin:0}
.cb button,.cb input,.cb textarea{font:inherit;color:inherit}
.cb :focus-visible{outline:2px solid var(--glow);outline-offset:2px}
.cb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

.cb-head{display:flex;flex-wrap:wrap;align-items:center;gap:14px 24px;justify-content:space-between;flex-shrink:0;padding:14px 14px 0}
.cb-title{display:flex;align-items:center;gap:12px}
.cb-title h2{font-size:19px;font-weight:650;letter-spacing:-.01em}
.cb-pill{display:inline-flex;align-items:center;gap:7px;padding:3px 10px;border:1px solid var(--line);border-radius:999px;font-size:12.5px;color:var(--muted)}
.cb-pill i{width:8px;height:8px;border-radius:50%;background:var(--muted)}
.cb-online{color:var(--text)}.cb-online i{background:var(--glow);box-shadow:0 0 0 0 rgb(var(--brand-accent) / .5);animation:cb-pulse 2.4s infinite}
.cb-offline i{background:#ff7a90}
@keyframes cb-pulse{70%{box-shadow:0 0 0 7px rgb(var(--brand-accent) / 0)}100%{box-shadow:0 0 0 0 rgb(var(--brand-accent) / 0)}}
.cb-people{display:flex;align-items:center}
.cb-people .cb-av{margin-left:-7px;border:2px solid var(--surface)}.cb-people .cb-av:first-child{margin-left:0}
.cb-count{margin-left:12px;color:var(--muted);font-size:13px}
.cb-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#041238;font-weight:700;flex:none}
.cb-av-typing{animation:cb-type 1s ease-in-out infinite alternate}
@keyframes cb-type{to{transform:translateY(-3px)}}
.cb-me{display:flex;gap:8px;align-items:center}
.cb-user-name{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12.5px}
.cb-me input{width:150px;padding:7px 10px;background:var(--panel);border:1px solid var(--line);border-radius:8px}
.cb-invite-trigger{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid rgb(var(--button-primary));border-radius:9px;background:linear-gradient(180deg,rgb(var(--button-primary-bright)),rgb(var(--button-primary)));color:rgb(var(--button-label,#041238));font-size:12px;font-weight:700;box-shadow:0 6px 18px rgb(var(--button-primary) / .32);cursor:pointer;transition:transform .15s,filter .15s,box-shadow .15s}
.cb-invite-trigger:hover{transform:translateY(-1px);background:linear-gradient(180deg,rgb(var(--button-primary-hover)),rgb(var(--button-primary)));filter:brightness(1.08);box-shadow:0 9px 22px rgb(var(--button-primary) / .4)}
.cb-invite-trigger:active{transform:translateY(0)}
.cb-invite-trigger:focus-visible,.cb-invite-send:focus-visible{outline:2px solid var(--glow);outline-offset:2px}
.cb-head-panels{display:flex;align-items:center;gap:5px}
.cb-head-panels button{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer}
.cb-head-panels button:hover,.cb-head-panels button[aria-pressed="true"]{border-color:var(--glow);background:rgb(var(--brand-accent) / .12);color:var(--text)}
.cb-unread{display:inline-grid;min-width:17px;height:17px;place-items:center;padding:0 4px;border-radius:999px;background:#d84d5a;color:#fff;font-size:10px;font-weight:700}

.cb-btn{padding:7px 13px;border:1px solid var(--line);border-radius:8px;background:var(--raise);cursor:pointer;transition:border-color .15s,background .15s}
.cb-btn:hover:not(:disabled){border-color:var(--glow)}
.cb-btn:disabled{opacity:.45;cursor:default}
.cb-btn-main{background:var(--glow);border-color:var(--glow);color:rgb(var(--button-label, 4 18 56));font-weight:600}
.cb-btn-main:hover:not(:disabled){background:rgb(var(--brand-bright))}

.cb-grid{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:0 14px 14px}
.cb-grid-panel-open{grid-template-columns:minmax(0,1fr) minmax(240px,300px)}
.cb-panel{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;overflow:hidden}
.cb-panel>h3{font-size:15px;font-weight:650;margin-bottom:10px}
.cb-empty{color:var(--muted);font-size:13px;padding:6px 2px}
.cb-add{display:flex;flex-direction:column;gap:7px}
.cb-add-row{display:flex;gap:8px}
.cb-add input{flex:1;min-width:0;padding:7px 10px;background:var(--surface);border:1px solid var(--line);border-radius:8px}
.cb-reply-composer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-left:2px solid var(--glow);border-radius:4px;background:var(--raise);color:var(--muted);font-size:10px}
.cb-reply-composer b{color:var(--text)}
.cb-reply-composer button{display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer}
.cb-reply-composer button:hover{background:var(--line);color:var(--text)}
.cb-workspace{position:relative;display:grid;grid-template-columns:minmax(180px,220px) minmax(0,1fr);min-width:0;min-height:0;height:100%;gap:10px}
.cb-explorer{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.cb-explorer-head{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 7px}
.cb-explorer-title{display:flex;align-items:center;gap:5px}
.cb-explorer-toolbar{display:flex;align-items:center;gap:2px}
.cb-explorer-head h3{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.cb-project-root{display:flex;align-items:center;gap:5px;min-height:29px;padding:0 10px;border-bottom:1px solid var(--line);color:var(--text);font-size:11px;font-weight:650;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-explorer-action{display:grid;place-items:center;width:27px;height:27px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}
.cb-explorer-action:hover{background:var(--raise);color:var(--text)}
.cb-explorer-actions{display:flex;gap:5px;padding:0 8px 8px;border-bottom:1px solid var(--line)}
.cb-explorer-actions button{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:1;padding:6px 4px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--muted);font-size:11px;cursor:pointer}
.cb-explorer-actions button:hover:not(:disabled){border-color:var(--glow);color:var(--text)}
.cb-explorer-actions button:disabled{opacity:.55;cursor:wait}
.cb-hidden-input{display:none}
.cb-create-file{display:flex;gap:5px;padding:7px 8px;border-bottom:1px solid var(--line)}
.cb-create-file input{width:0;flex:1;min-width:0;padding:5px 7px;border:1px solid var(--line);border-radius:5px;background:var(--surface);font:11px ui-monospace,monospace}
.cb-create-file button{display:grid;place-items:center;width:27px;border:0;border-radius:5px;background:var(--raise);color:var(--text);cursor:pointer}
.cb-upload-notice,.cb-upload-error{padding:7px 9px;font-size:10.5px;line-height:1.4;overflow-wrap:anywhere}
.cb-upload-notice{color:var(--glow)}
.cb-upload-error{color:#ff9daa}
.cb-file-tree{overflow:auto;min-height:0;padding:5px 4px}
.cb-file-entry{display:flex;align-items:center;gap:2px;width:100%;min-height:27px;padding-top:2px;padding-right:5px;padding-bottom:2px;border:0;border-radius:5px;background:transparent;color:var(--muted);font-size:12px}
.cb-file-entry:hover{background:var(--raise);color:var(--text)}
.cb-file-select{display:flex;align-items:center;gap:6px;flex:1;min-width:0;min-height:25px;padding:2px 0;border:0;background:transparent;color:inherit;text-align:left;font-size:12px;cursor:pointer}
.cb-file-delete{display:grid;place-items:center;width:22px;height:20px;margin-left:auto;border:0;border-radius:4px;background:transparent;color:var(--muted);opacity:0;cursor:pointer}
.cb-file-entry:hover .cb-file-delete,.cb-file-delete:focus-visible{opacity:1}
.cb-file-delete:hover{background:#7d2330;color:#ffb5bd}
.cb-file-entry-active{background:rgb(var(--brand-accent) / .12);color:var(--glow)}
.cb-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-file-icon{width:14px;height:14px;flex-shrink:0}
.cb-file-spacer{width:13px;flex:none}
.cb-tree-empty{padding:12px;color:var(--muted);font-size:11px;line-height:1.5}
.cb-side-panel{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.cb-side-tabs{display:flex;gap:4px;padding:7px;border-bottom:1px solid var(--line)}
.cb-side-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;flex:1;padding:7px 5px;border:0;border-radius:6px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer}
.cb-side-tabs button[aria-selected="true"]{background:var(--raise);color:var(--text)}
.cb-side-tabs .cb-side-close{flex:0 0 30px}
.cb-side-panel .cb-panel{flex:1;height:100%;min-height:0;border:0;border-radius:0;padding:10px}

.cb-lanes{margin-top:12px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:0}
.cb-lane{padding:8px;border:1px dashed var(--line);border-radius:10px;transition:background .15s,border-color .15s}
.cb-lane h4{font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px}
.cb-lane h4 span{margin-left:4px;color:var(--text)}
.cb-over{background:rgb(var(--brand-accent) / .12);border-color:var(--glow)}
.cb-card{margin-top:6px;padding:9px 10px;background:var(--raise);border:1px solid var(--line);border-radius:9px;cursor:grab}
.cb-card:active{cursor:grabbing}
.cb-card p{margin-bottom:8px}
.cb-card footer{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cb-chip{padding:2px 9px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--muted);cursor:pointer;font-size:12.5px}
.cb-chip:hover{border-color:var(--glow);color:var(--text)}
.cb-chip-on{font-weight:600}
.cb-move{display:flex;gap:2px}
.cb-icon{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;font-size:16px;line-height:1}
.cb-icon:hover:not(:disabled){background:var(--surface);color:var(--text)}
.cb-icon:disabled{opacity:.3;cursor:default}

.cb-editor{padding:0;min-width:0;height:100%;min-height:0;display:flex;flex-direction:column}
.cb-tabs{display:flex;align-items:stretch;gap:0;min-height:39px;padding:0 8px;border-bottom:1px solid var(--line);overflow-x:auto;flex-shrink:0}
.cb-tab-group{position:relative;display:flex;align-items:center;flex:none;border-right:1px solid rgb(var(--midnight-border) / .6)}
.cb-tab-group-on{background:var(--raise)}
.cb-tab{display:flex;align-items:center;gap:7px;min-width:0;max-width:220px;height:39px;padding:0 9px;border:0;border-top:1px solid transparent;border-bottom:1px solid transparent;background:transparent;color:var(--muted);cursor:pointer;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:nowrap}
.cb-tab span{overflow:hidden;text-overflow:ellipsis}
.cb-tab-dirty{width:7px;height:7px;flex:none;border-radius:50%;background:#fbbf24}
.cb-tab-group-on .cb-tab{border-top-color:var(--glow);color:var(--text)}
.cb-tab:hover{color:var(--text)}
.cb-tab-close{display:grid;place-items:center;width:22px;height:22px;margin-right:4px;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer;opacity:0}
.cb-tab-group:hover .cb-tab-close,.cb-tab-group-on .cb-tab-close,.cb-tab-close:focus-visible{opacity:1}
.cb-tab-close:hover{background:var(--raise);color:var(--text)}
.cb-editor-download,.cb-editor-save,.cb-github-push{display:grid;place-items:center;flex:none;width:29px;height:29px;margin:4px 3px;border:0;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.cb-editor-download:hover{background:var(--raise);color:var(--text)}
.cb-github-push{color:#c4b5fd}
.cb-github-push:hover:not(:disabled){background:#312e81;color:#ddd6fe}
.cb-github-push:disabled{opacity:.35;cursor:not-allowed}
.cb-editor-save{color:var(--glow)}
.cb-editor-save:hover:not(:disabled){background:rgb(var(--brand-accent) / .14);color:var(--text)}
.cb-editor-save:disabled{opacity:.35;cursor:default}
.cb-here{margin-left:auto;display:flex;gap:3px;align-items:center;padding:0 6px}
.cb-breadcrumbs{display:flex;align-items:center;gap:7px;min-height:30px;padding:0 12px;color:var(--muted);font-family:ui-monospace,monospace;font-size:11px;flex-shrink:0}
.cb-breadcrumbs span:last-child{color:var(--text)}
.cb-live-typing{display:flex;align-items:center;gap:8px;min-height:29px;padding:3px 11px;border-bottom:1px solid var(--line);background:var(--raise);color:var(--muted);font-size:11px;flex-shrink:0}
.cb-live-typing-avatars{display:flex;align-items:center;gap:4px}
.cb-live-typing>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-live-typing .cb-av{border:1px solid var(--line);font-size:0!important}
.cb-code{position:relative;flex:1;height:100%;min-height:0;background:var(--surface)}
.cb-statusbar{display:flex;align-items:center;gap:15px;min-height:24px;padding:0 10px;background:var(--glow);color:rgb(var(--button-label,#041238));font-size:10px;flex-shrink:0}
.cb-statusbar>span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.cb-statusbar .cb-save-indicator{color:rgb(var(--button-label,#041238))}
.cb-save-indicator i{width:6px;height:6px;border-radius:50%;background:currentColor}
.cb-statusbar .cb-save-dirty{color:#fff0c2}
.cb-save-dirty i{background:#fbbf24}
.cb-statusbar .cb-save-error{color:#ffe4e7}
.cb-save-error i{background:#fb7185}
.cb-diagnostics-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border:1px solid rgb(var(--brand-accent) / .48);border-radius:999px;background:rgb(var(--brand-accent) / .14);color:var(--glow);font-size:9px;white-space:nowrap;cursor:pointer}
.cb-diagnostics-badge i{width:6px;height:6px;border-radius:50%;background:var(--glow)}
.cb-diagnostics-badge:hover{background:rgb(var(--brand-accent) / .22)}
.cb-diagnostics-errors{border-color:#ffb4bc99;background:#7d2330;color:#ffe4e7}
.cb-diagnostics-errors i{background:#fb7185}
.cb-diagnostics-warnings{border-color:#ffe3a399;background:#76541a;color:#fff0c2}
.cb-diagnostics-warnings i{background:#fbbf24}
.cb-diagnostics-popover{position:absolute;right:12px;bottom:32px;z-index:20;width:min(460px,calc(100% - 24px));max-height:40%;overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--panel);box-shadow:0 12px 32px #0009;color:var(--text)}
.cb-diagnostics-popover header{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid var(--line);font-size:11px}
.cb-diagnostics-popover header button{display:grid;place-items:center;width:24px;height:24px;border:0;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.cb-diagnostics-popover header button:hover{background:var(--raise);color:var(--text)}
.cb-diagnostics-popover ul{list-style:none;padding:4px}
.cb-diagnostics-popover li+li{border-top:1px solid rgb(var(--midnight-border) / .6)}
.cb-diagnostics-popover li button{display:flex;align-items:center;gap:8px;width:100%;padding:8px;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer}
.cb-diagnostics-popover li button:hover{background:var(--raise)}
.cb-diagnostic-error{flex:none;color:#fb7185;font-size:9px;font-weight:700}
.cb-diagnostic-warning{flex:none;color:#fbbf24;font-size:9px;font-weight:700}
.cb-diagnostic-message{min-width:0;flex:1;overflow-wrap:anywhere;font-size:10px}
.cb-diagnostics-popover li small{flex:none;color:var(--muted);font-size:9px}
.cb-diagnostics-empty{padding:12px;color:var(--glow);font-size:10px}
.cb-status-spacer{flex:1}
.cb-status-connection i{width:6px;height:6px;border-radius:50%;background:#a7f3d0}
.cb-status-offline i{background:#ffb4bc}
.cb-status-connecting i{background:#ffe3a3}
.cb-quick-open-backdrop{position:absolute;inset:0;z-index:60;display:flex;justify-content:center;align-items:flex-start;padding:8vh 20px 20px;background:#02090dcc;backdrop-filter:blur(4px)}
.cb-quick-open{width:min(620px,100%);max-height:min(70vh,620px);overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--panel);box-shadow:0 24px 80px #0009}
.cb-quick-open-input{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);color:var(--muted)}
.cb-quick-open-input input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:13px ui-monospace,monospace}
.cb-quick-open-input kbd,.cb-quick-open footer kbd{padding:2px 5px;border:1px solid var(--line);border-radius:4px;color:var(--muted);font:10px ui-monospace,monospace}
.cb-quick-open-results{max-height:calc(min(70vh,620px) - 100px);overflow:auto;padding:5px}
.cb-quick-open-results button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:5px;background:transparent;color:var(--text);text-align:left;font:12px ui-monospace,monospace;cursor:pointer}
.cb-quick-open-results button:hover,.cb-quick-open-results button[aria-selected="true"]{background:var(--raise)}
.cb-quick-open-results button span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-quick-open-results button small{color:var(--muted);font:10px ui-monospace,monospace}
.cb-quick-open-empty{padding:20px;text-align:center;color:var(--muted);font-size:12px}
.cb-quick-open>footer{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}
.cb-github-backdrop{position:fixed;inset:0;z-index:110;display:grid;place-items:center;overflow-y:auto;padding:16px;background:#02090dd9;backdrop-filter:blur(7px)}
.cb-github-modal{width:min(500px,100%);overflow:hidden;border:1px solid var(--line);border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--panel),var(--glow) 8%),var(--panel) 58%,var(--surface));color:var(--text);box-shadow:0 30px 100px #000b}
.cb-github-modal>header{display:flex;align-items:center;gap:12px;padding:17px 19px;border-bottom:1px solid var(--line)}
.cb-github-icon{display:grid;width:38px;height:38px;flex:none;place-items:center;border:1px solid #8b5cf677;border-radius:11px;background:#5b21b629;color:#c4b5fd}
.cb-github-heading{min-width:0;flex:1}
.cb-github-heading h2{font-size:15px;font-weight:650}
.cb-github-heading a{display:block;overflow:hidden;color:var(--glow);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.cb-github-modal>header>button{display:grid;width:30px;height:30px;flex:none;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}
.cb-github-modal>header>button:hover{background:var(--raise);color:var(--text)}
.cb-github-form{display:grid;gap:12px;padding:18px 20px}
.cb-github-form label{display:grid;gap:5px;color:var(--text);font-size:11px;font-weight:600}
.cb-github-form input,.cb-github-form select{width:100%;min-height:36px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;outline:none;background:var(--surface);color:var(--text);font-size:12px}
.cb-github-form input:focus,.cb-github-form select:focus{border-color:var(--glow)}
.cb-github-help{color:var(--muted);font-size:10px;line-height:1.55}
.cb-github-secondary,.cb-github-primary{display:inline-flex;min-height:34px;align-items:center;justify-content:center;gap:7px;padding:7px 11px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--text);font-size:11px;font-weight:600;cursor:pointer}
.cb-github-secondary:hover:not(:disabled){border-color:var(--glow)}
.cb-github-primary{border-color:var(--glow);background:var(--glow);color:rgb(var(--button-label,#041238))}
.cb-github-primary:hover:not(:disabled){background:rgb(var(--brand-bright));}
.cb-github-primary:disabled,.cb-github-secondary:disabled{opacity:.45;cursor:not-allowed}
.cb-github-modal>footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--line)}
.cb-github-error,.cb-github-success{font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.cb-github-error{color:#ff9daa}
.cb-github-success{color:var(--glow)}
.cb-invite-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;overflow-y:auto;padding:20px;background:#02090dd9;backdrop-filter:blur(7px)}
.cb-invite-modal{display:flex;width:min(680px,100%);max-height:min(850px,calc(100dvh - 40px));flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--panel),var(--glow) 8%),var(--panel) 48%,var(--surface));color:var(--text);box-shadow:0 30px 100px #000b}
.cb-invite-header{display:flex;align-items:flex-start;gap:14px;padding:22px 24px 18px;border-bottom:1px solid var(--line);background:radial-gradient(380px 160px at 0% 0%,rgb(var(--brand-accent) / .12),transparent 70%)}
.cb-invite-heading-icon{display:grid;width:44px;height:44px;flex:none;place-items:center;border:1px solid rgb(var(--brand-accent) / .48);border-radius:13px;background:rgb(var(--brand-accent) / .16);color:var(--glow)}
.cb-invite-eyebrow{color:var(--glow);font-size:9px;font-weight:750;letter-spacing:.15em}
.cb-invite-header h2{margin-top:5px;color:var(--text);font-size:20px;font-weight:700;letter-spacing:-.02em}
.cb-invite-header p:not(.cb-invite-eyebrow){margin-top:5px;color:var(--muted);font-size:12px;line-height:1.55}
.cb-invite-close{display:grid;width:34px;height:34px;flex:none;place-items:center;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--muted);cursor:pointer}
.cb-invite-close:hover{border-color:var(--glow);color:var(--text)}
.cb-invite-role{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:16px 22px 0;color:var(--muted);font-size:11px}
.cb-invite-role-select{position:relative;width:min(300px,65%)}
.cb-invite-role-trigger{display:flex;width:100%;min-height:44px;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,var(--raise),var(--surface));color:var(--text);text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.cb-invite-role-trigger:hover,.cb-invite-role-trigger[aria-expanded="true"]{border-color:var(--glow);box-shadow:0 0 0 3px rgb(var(--brand-accent) / .14)}
.cb-invite-role-trigger>svg{flex:none;color:#80a99e;transition:transform .15s}
.cb-invite-role-trigger[aria-expanded="true"]>svg{transform:rotate(180deg)}
.cb-invite-role-current,.cb-invite-role-option>span{display:grid;min-width:0;gap:3px}
.cb-invite-role-current strong,.cb-invite-role-option strong{color:var(--text);font-size:11px;font-weight:650}
.cb-invite-role-current small,.cb-invite-role-option small{overflow:hidden;color:var(--muted);font-size:9px;font-weight:400;text-overflow:ellipsis;white-space:nowrap}
.cb-invite-role-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:10;width:100%;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--panel);box-shadow:0 14px 36px #000b}
.cb-invite-role-option{display:flex;width:100%;min-height:47px;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:0;border-bottom:1px solid rgb(var(--midnight-border) / .6);background:transparent;text-align:left;cursor:pointer}
.cb-invite-role-option:last-child{border-bottom:0}
.cb-invite-role-option:hover,.cb-invite-role-option[aria-selected="true"]{background:rgb(var(--brand-accent) / .12)}
.cb-invite-role-option>svg{flex:none;color:var(--glow)}
.cb-invite-owner-note{display:flex;align-items:center;gap:10px;margin:16px 22px 0;padding:11px 12px;border:1px solid rgb(var(--brand-accent) / .36);border-radius:10px;background:rgb(var(--brand-accent) / .08);color:var(--glow);font-size:11px;line-height:1.5}
.cb-invite-search{display:flex;align-items:center;gap:10px;margin:16px 22px 12px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--muted)}
.cb-invite-search:focus-within{border-color:var(--glow);box-shadow:0 0 0 3px rgb(var(--brand-accent) / .14)}
.cb-invite-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:12px}
.cb-invite-search input::placeholder{color:#6e9290}
.cb-invite-search button{display:grid;width:22px;height:22px;flex:none;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}
.cb-invite-list{min-height:180px;flex:1;overflow-y:auto;padding:0 22px 12px}
.cb-invite-maker{display:flex;align-items:center;gap:11px;padding:12px 2px;border-bottom:1px solid rgb(var(--midnight-border) / .5)}
.cb-invite-maker-info{min-width:0;flex:1}
.cb-invite-maker-name{display:flex;align-items:center;gap:8px;min-width:0;color:var(--text);font-size:12px;font-weight:650}
.cb-invite-maker-name>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-invite-maker-info p,.cb-invite-maker-info small{display:block;overflow:hidden;margin-top:3px;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.cb-invite-open{flex:none;padding:3px 6px;border:1px solid rgb(var(--brand-accent) / .32);border-radius:999px;background:rgb(var(--brand-accent) / .1);color:var(--glow);font-size:8px;font-weight:600}
.cb-invite-send{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:84px;padding:7px 10px;border:1px solid var(--glow);border-radius:8px;background:var(--glow);color:rgb(var(--button-label,#041238));font-size:10px;font-weight:700;cursor:pointer}
.cb-invite-send:hover:not(:disabled){background:rgb(var(--brand-bright))}
.cb-invite-send:disabled{cursor:not-allowed;opacity:.5}
.cb-invite-cancel{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:84px;padding:7px 9px;border:1px solid #8a475466;border-radius:8px;background:#7d233024;color:#ffc1ca;font-size:10px;font-weight:650;cursor:pointer;transition:background .15s,border-color .15s}
.cb-invite-cancel:hover:not(:disabled){border-color:#bf536588;background:#7d233055}
.cb-invite-cancel:disabled{cursor:wait;opacity:.55}
.cb-invite-member,.cb-invite-pending{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid rgb(var(--brand-accent) / .36);border-radius:8px;color:var(--glow);font-size:9px;white-space:nowrap}
.cb-invite-pending{border-color:#6b5b2a88;color:#dfc879}
.cb-invite-loading,.cb-invite-empty{display:flex;min-height:100px;align-items:center;justify-content:center;gap:9px;color:var(--muted);font-size:11px;text-align:center}
.cb-invite-empty{flex-direction:column}
.cb-invite-empty button{border:0;background:transparent;color:var(--glow);text-decoration:underline;cursor:pointer}
.cb-invite-pagination{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;color:var(--muted);font-size:10px}
.cb-invite-pagination button{padding:6px 9px;border:1px solid rgb(var(--brand-accent) / .36);border-radius:7px;background:rgb(var(--brand-accent) / .08);color:var(--glow);font-size:10px;cursor:pointer}
.cb-invite-pagination button:hover:not(:disabled){background:rgb(var(--brand-accent) / .16)}
.cb-invite-pagination button:disabled{cursor:default;opacity:.45}
.cb-invite-error,.cb-invite-success{display:flex;align-items:center;gap:7px;margin:0 22px 10px;padding:9px 11px;border:1px solid #b6485a66;border-radius:8px;background:#7d233019;color:#ff9daa;font-size:11px}
.cb-invite-success{border-color:rgb(var(--brand-accent) / .36);background:rgb(var(--brand-accent) / .1);color:var(--glow)}
.cb-invite-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-top:1px solid var(--line);background:var(--surface);color:var(--muted);font-size:10px}
.cb-invite-footer button{padding:7px 13px;border:1px solid var(--glow);border-radius:8px;background:var(--glow);color:rgb(var(--button-label,#041238));font-size:10px;font-weight:700;cursor:pointer}
.cb-invite-footer button:hover{background:rgb(var(--brand-bright))}

.cb-chat{min-width:0;min-height:0}
.cb-log{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:9px;margin-bottom:10px;padding-right:2px}
.cb-msg{display:grid;grid-template-columns:22px minmax(0,1fr);align-items:start;column-gap:7px}
.cb-msg-content{min-width:0}
.cb-msg-meta{display:flex;align-items:center;gap:7px;min-width:0}
.cb-msg-meta b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.cb-msg-meta time{flex:none;color:var(--muted);font-size:9px}
.cb-msg-actions{display:inline-flex;align-items:center;gap:3px;margin-left:auto;opacity:0}
.cb-msg:hover .cb-msg-actions,.cb-msg:focus-within .cb-msg-actions{opacity:1}
.cb-msg-actions button{display:inline-flex;align-items:center;gap:3px;padding:2px 4px;border:0;border-radius:4px;background:transparent;color:var(--muted);font-size:9px;cursor:pointer}
.cb-msg-actions button:hover{background:var(--raise);color:var(--text)}
.cb-msg-content>p{margin-top:2px;overflow-wrap:anywhere;white-space:pre-wrap;font-size:11px;line-height:1.45}
.cb-msg-me .cb-msg-content>p{color:var(--glow)}
.cb-msg-quote{display:flex;flex-direction:column;gap:2px;margin-top:5px;padding:5px 7px;border-left:2px solid var(--glow);border-radius:3px;background:var(--raise);color:var(--muted);font-size:9px}
.cb-msg-quote b{color:var(--text);font-size:9px}
.cb-msg-quote span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-msg-content>p.cb-msg-deleted{color:var(--muted);font-style:italic}
.cb-msg-error{display:block;margin-top:3px;color:#ff9daa;font-size:9px}
.cb-notice{color:var(--muted);font-size:12.5px;text-align:center}
.cb-activity{min-width:0;min-height:0}
.cb-activity-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px}
.cb-activity-entry{display:flex;align-items:flex-start;gap:8px}
.cb-activity-copy{min-width:0;font-size:11px;line-height:1.55}
.cb-activity-copy b{color:var(--text)}
.cb-activity-copy code{overflow-wrap:anywhere;color:var(--glow);font-size:10px}
.cb-activity-copy time{display:block;color:var(--muted);font-size:9px}

.cb-cursors{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:50}
.cb-cursor{position:absolute;transition:left .06s linear,top .06s linear}
.cb-cursor svg{display:block}
.cb-cursor span{position:absolute;left:14px;top:12px;padding:1px 7px;border-radius:5px;color:#041238;font-size:11.5px;font-weight:650;white-space:nowrap}

@media (max-width:840px){
  .cb{height:100%;min-height:0}
  .cb-grid-panel-open{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(280px,1fr) minmax(260px,40dvh);overflow:auto}
  .cb-grid-panel-open .cb-workspace{min-height:280px}
  .cb-workspace{grid-template-columns:minmax(155px,190px) minmax(0,1fr)}
  .cb-side-panel{min-height:260px;max-height:520px}
  .cb-me input{width:120px}
}
@media (max-width:640px){
  .cb-head{gap:8px;padding:10px 10px 0}
  .cb-grid{padding:0 10px 10px}
  .cb-workspace{grid-template-columns:minmax(130px,160px) minmax(0,1fr);gap:6px}
  .cb-head-panels button{padding:6px;font-size:0}
  .cb-head-panels button svg{width:16px;height:16px}
  .cb-statusbar{gap:8px;padding:0 6px;font-size:9px}
  .cb-statusbar>span:last-child{display:none}
  .cb-quick-open-backdrop{padding:16px 10px}
  .cb-invite-backdrop{padding:10px}
  .cb-invite-header{padding:17px}
  .cb-invite-role,.cb-invite-search{margin-right:15px;margin-left:15px}
  .cb-invite-list{padding-right:15px;padding-left:15px}
  .cb-invite-footer{align-items:flex-start;padding:11px 15px}
  .cb-invite-open{display:none}
}
@media (prefers-reduced-motion:reduce){
  .cb *,.cb-cursor,.cb-mark{animation:none!important;transition:none!important}
}
`;
