"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Circle, Clock3, Pause, Play, Plus, RotateCcw, Sparkles, Target, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type DemoTask = { id: number; title: string; titleKey?: string; done: boolean; due: string };

const initialTasks: DemoTask[] = [
  { id: 1, title: "taskOne", titleKey: "testerApplications.demo.taskOne", done: false, due: "09:30" },
  { id: 2, title: "taskTwo", titleKey: "testerApplications.demo.taskTwo", done: false, due: "11:00" },
  { id: 3, title: "taskThree", titleKey: "testerApplications.demo.taskThree", done: true, due: "14:00" },
];

export default function TempoInteractiveDemoPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title) return;
    setTasks((current) => [...current, { id: Date.now(), title, done: false, due: t("testerApplications.demo.taskUnscheduled") }]);
    setNewTask("");
  }

  const completedTasks = tasks.filter((task) => task.done).length;
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 xl:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/tester-applications/demo-tempo" className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"><ArrowLeft size={16} /> {t("testerApplications.demo.back")}</Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200"><Sparkles size={14} /> {t("testerApplications.demo.label")}</span>
      </div>

      <header className="card flex flex-wrap items-center gap-4 rounded-3xl p-5 sm:p-7">
        <Image src="/tester-demo/tempo-mark.svg" alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded-2xl" />
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.demo.eyebrow")}</p><h1 className="mt-1 font-display text-2xl font-semibold text-ink">{t("testerApplications.demo.title")}</h1></div>
        <p className="max-w-xs text-xs leading-5 text-ink-muted">{t("testerApplications.demo.description")}</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
        <article className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight-border/70 p-5">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.demo.focusSession")}</p><h2 className="mt-1 text-lg font-semibold text-ink">{t("testerApplications.demo.sprintTitle")}</h2></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-midnight-card/80 px-3 py-1.5 text-xs text-ink-muted"><Clock3 size={14} /> {t("testerApplications.demo.pomodoro")}</span>
          </div>
          <div className="flex flex-col items-center px-6 py-10 text-center sm:py-14">
            <div className="relative grid h-56 w-56 place-items-center rounded-full border-[10px] border-midnight-border/80 sm:h-64 sm:w-64" style={{ background: `conic-gradient(#42d6a4 ${(1500 - seconds) / 15}%, transparent 0)` }}>
              <div className="grid h-[calc(100%-12px)] w-[calc(100%-12px)] place-content-center rounded-full bg-midnight-card/80">
                <span className="font-display text-5xl font-semibold tabular-nums tracking-tight text-ink">{minutes}:{remainingSeconds}</span>
                <span className="mt-2 text-sm text-ink-muted">{running ? t("testerApplications.demo.running") : seconds === 0 ? t("testerApplications.demo.finished") : t("testerApplications.demo.ready")}</span>
              </div>
            </div>
            <p className="mt-6 max-w-sm text-sm text-ink-muted">{t("testerApplications.demo.focusHint")}</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setRunning((current) => !current)} disabled={seconds === 0} className="btn-gold min-w-36 justify-center disabled:opacity-50">{running ? <><Pause size={16} /> {t("testerApplications.demo.pause")}</> : <><Play size={16} /> {seconds === 1500 ? t("testerApplications.demo.start") : t("testerApplications.demo.resume")}</>}</button>
              <button type="button" onClick={() => { setRunning(false); setSeconds(1500); }} aria-label={t("testerApplications.demo.resetTimer")} className="btn-ghost"><RotateCcw size={16} /> {t("testerApplications.demo.reset")}</button>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="flex items-center justify-between border-b border-midnight-border/70 p-5">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("testerApplications.demo.today")}</p><h2 className="mt-1 text-lg font-semibold text-ink">{t("testerApplications.demo.priorities")}</h2></div>
            <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">{t("testerApplications.demo.completed", { done: completedTasks, total: tasks.length })}</span>
          </div>
          <form onSubmit={addTask} className="flex gap-2 border-b border-midnight-border/70 p-4">
            <label htmlFor="demo-new-task" className="sr-only">{t("testerApplications.demo.addPriority")}</label>
            <input id="demo-new-task" value={newTask} onChange={(event) => setNewTask(event.target.value)} maxLength={120} className="input min-w-0 flex-1" placeholder={t("testerApplications.demo.addPriorityPlaceholder")} />
            <button type="submit" disabled={!newTask.trim()} aria-label={t("testerApplications.demo.addTask")} className="btn-gold !px-3 disabled:opacity-40"><Plus size={17} /></button>
          </form>
          <ul className="divide-y divide-midnight-border/70 px-4">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-4">
                <button type="button" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} aria-label={task.done ? t("testerApplications.demo.markTodo", { task: task.titleKey ? t(task.titleKey) : task.title }) : t("testerApplications.demo.completeTask", { task: task.titleKey ? t(task.titleKey) : task.title })} className={`shrink-0 ${task.done ? "text-emerald-200" : "text-ink-muted hover:text-emerald-200"}`}>{task.done ? <Check size={19} /> : <Circle size={19} />}</button>
                <span className={`min-w-0 flex-1 text-sm leading-5 ${task.done ? "text-ink-muted line-through" : "text-ink"}`}>{task.titleKey ? t(task.titleKey) : task.title}<span className="mt-1 block text-xs text-ink-muted">{task.due}</span></span>
                <button type="button" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} aria-label={t("testerApplications.demo.deleteTask", { task: task.titleKey ? t(task.titleKey) : task.title })} className="rounded-lg p-2 text-ink-muted transition hover:bg-rose-300/10 hover:text-rose-200"><Trash2 size={15} /></button>
              </li>
            ))}
            {tasks.length === 0 && <li className="py-8 text-center text-sm text-ink-muted">{t("testerApplications.demo.emptyTasks")}</li>}
          </ul>
          <div className="border-t border-midnight-border/70 p-4 text-xs leading-5 text-ink-muted"><Target size={14} className="mr-1.5 inline text-emerald-200" />{t("testerApplications.demo.tip")}</div>
        </article>
      </section>

      <Link href="/tester-applications/demo-tempo#tester-workspace" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-200 transition hover:text-emerald-100">{t("testerApplications.demo.feedback")} <Check size={16} /></Link>
    </main>
  );
}
