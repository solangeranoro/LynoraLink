"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Bell, Check, Code2, FolderKanban, MessageCircleMore, MessagesSquare, Send, ThumbsUp, UsersRound } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";

type DemoTab = "discussion" | "files" | "tasks" | "poll";
type PollOption = "React" | "Vue" | "Angular" | "Other";

const demoTabs: DemoTab[] = ["discussion", "files", "tasks", "poll"];

const copy = {
  en: {
    eyebrow: "Inside the project workspace",
    title: "Tasks, files, conversations and decisions—connected to the work.",
    description: "Keep the team's context close: review a prototype, assign the next task, share a file, and decide what to test next without losing the conversation.",
    search: "Search projects and makers...",
    navigation: ["Home", "Projects", "Discussions", "Polls"],
    projectDescription: "Beta in progress · Looking for product feedback",
    tabs: [
      { id: "discussion" as const, label: "Discussion" },
      { id: "files" as const, label: "Files" },
      { id: "tasks" as const, label: "Tasks" },
      { id: "poll" as const, label: "Polls" },
    ],
    messages: [
      { author: "Alex Dev", time: "10:24", text: "The new onboarding flow is ready for a first review." },
      { author: "Mira Chen", time: "10:32", text: "I’ll test it today and add notes to the task." },
    ],
    input: "Write a message...",
    send: "Send message",
    poll: "What should we validate in the next beta?",
    vote: "Vote",
    voted: "Vote recorded",
    online: "makers online",
    members: "PROJECT TEAM",
    project: "NextGenApp",
    joinProject: "View project",
    files: "Project files",
    tasks: ["Review the onboarding flow", "Collect tester feedback", "Plan the next release"],
    featuresTitle: "The project stays connected to its people and decisions.",
    features: [
      { title: "A shared project space", description: "Keep project updates, people, and next steps easy to find.", icon: FolderKanban },
      { title: "Conversations with context", description: "Discuss the work with your team and keep decisions visible.", icon: MessagesSquare },
      { title: "Feedback you can act on", description: "Use polls and tester reviews to choose what to improve next.", icon: BarChart3 },
    ],
  },
  fr: {
    eyebrow: "Dans l’espace de travail du projet",
    title: "Tâches, fichiers, échanges et décisions : tout relié au projet.",
    description: "Gardez le contexte d’équipe à portée de main : relisez un prototype, préparez la prochaine tâche, partagez un fichier et choisissez quoi tester sans perdre le fil.",
    search: "Rechercher des projets et des makers...",
    navigation: ["Accueil", "Projets", "Discussions", "Sondages"],
    projectDescription: "Bêta en cours · Retours produit recherchés",
    tabs: [
      { id: "discussion" as const, label: "Discussion" },
      { id: "files" as const, label: "Fichiers" },
      { id: "tasks" as const, label: "Tâches" },
      { id: "poll" as const, label: "Sondages" },
    ],
    messages: [
      { author: "Alex Dev", time: "10:24", text: "Le nouveau parcours d’inscription est prêt pour une première revue." },
      { author: "Mira Chen", time: "10:32", text: "Je le teste aujourd’hui et j’ajoute mes notes à la tâche." },
    ],
    input: "Écrire un message...",
    send: "Envoyer le message",
    poll: "Que faut-il valider dans la prochaine bêta ?",
    vote: "Voter",
    voted: "Vote enregistré",
    online: "makers en ligne",
    members: "ÉQUIPE PROJET",
    project: "NextGenApp",
    joinProject: "Voir le projet",
    files: "Fichiers du projet",
    tasks: ["Revoir le parcours d’inscription", "Recueillir les retours des testeurs", "Préparer la prochaine version"],
    featuresTitle: "Le projet reste relié à son équipe et à ses décisions.",
    features: [
      { title: "Un espace projet partagé", description: "Retrouvez facilement les avancées, l’équipe et les prochaines étapes.", icon: FolderKanban },
      { title: "Des échanges contextualisés", description: "Discutez du travail avec l’équipe et gardez les décisions visibles.", icon: MessagesSquare },
      { title: "Des retours à mettre en pratique", description: "Utilisez sondages et avis des testeurs pour choisir la suite.", icon: BarChart3 },
    ],
  },
} as const;

const initialVotes: Record<PollOption, number> = { React: 42, Vue: 28, Angular: 18, Other: 12 };

export function LandingProductDemo() {
  const { locale } = useTranslation();
  const text = locale === "fr" ? copy.fr : copy.en;
  const demoWindowRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<DemoTab>("discussion");
  const [isDemoVisible, setIsDemoVisible] = useState(false);
  const [votes, setVotes] = useState(initialVotes);
  const [votedOption, setVotedOption] = useState<PollOption | null>(null);
  const [message, setMessage] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  useEffect(() => {
    const demoWindow = demoWindowRef.current;
    if (!demoWindow) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsDemoVisible(entry.isIntersecting),
      { rootMargin: "100px" },
    );
    observer.observe(demoWindow);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isDemoVisible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      const demoWindow = demoWindowRef.current;
      if (!demoWindow || document.hidden || demoWindow.matches(":hover") || demoWindow.contains(document.activeElement)) return;

      setActiveTab((current) => demoTabs[(demoTabs.indexOf(current) + 1) % demoTabs.length]);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [isDemoVisible]);

  function castVote(option: PollOption) {
    if (votedOption) {
      setVotes((current) => ({ ...current, [votedOption]: current[votedOption] - 1 }));
    } else {
      setVotes((current) => Object.fromEntries(Object.entries(current).map(([key, count]) => [key, count + (key === option ? 1 : 0)])) as Record<PollOption, number>);
      setVotedOption(option);
      return;
    }
    setVotes((current) => ({ ...current, [option]: current[option] + 1 }));
    setVotedOption(option);
  }

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setSentMessage(trimmed);
    setMessage("");
  }

  return (
    <section className="landing-demo-section text-[#10224c]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
        <div className="mb-12 max-w-3xl" data-landing-reveal="left">
          <p className="landing-eyebrow mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0878ff]">{text.eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-[#10224c] sm:text-5xl">{text.title}</h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#586b8c] sm:text-lg">{text.description}</p>
        </div>

        <div ref={demoWindowRef} data-landing-reveal="zoom" className="landing-demo-window overflow-hidden rounded-3xl border border-white/10 bg-[#0b1e2d] shadow-[0_35px_100px_rgba(0,0,0,0.38)]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#091824] px-4 py-3 sm:px-6">
            <span className="font-display text-sm font-bold tracking-tight text-white">Lynora<span className="text-[#8cff00]">Link</span></span>
            <div className="hidden max-w-sm flex-1 sm:block">
              <div className="rounded-lg border border-white/10 bg-[#112638] px-3 py-2 text-[10px] text-slate-500">{text.search}</div>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <Bell size={15} aria-hidden="true" />
              <span className="grid h-7 w-7 place-items-center rounded-full border border-[#0878ff]/50 bg-gradient-to-br from-[#0878ff] to-cyan-500 text-[10px] font-bold text-white">A</span>
            </div>
          </div>

          <div className="grid min-h-[27rem] sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
            <aside className="hidden border-r border-white/10 bg-[#081521] p-4 sm:block">
              <p className="mb-4 px-2 text-[9px] font-bold tracking-[0.16em] text-slate-500">{text.members}</p>
              <nav aria-label={text.members} className="space-y-1">
                {text.navigation.map((label, index) => (
                  <div key={label} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[11px] font-medium ${index === 0 ? "bg-[#0878ff]/15 text-[#8cff00]" : "text-slate-400"}`}>
                    {index === 0 ? <FolderKanban size={13} /> : index === 1 ? <Code2 size={13} /> : index === 2 ? <MessagesSquare size={13} /> : <BarChart3 size={13} />}
                    {label}
                  </div>
                ))}
              </nav>
              <div className="mt-7 border-t border-white/10 pt-4">
                <p className="px-2 text-[9px] font-bold tracking-[0.12em] text-slate-500">TEAM</p>
                <div className="mt-3 flex -space-x-2 px-2">
                  {["AL", "MC", "JS", "+3"].map((member, index) => (
                    <span key={member} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[#081521] text-[8px] font-bold text-white ${["bg-[#0878ff]", "bg-[#b17664]", "bg-[#697fa6]", "bg-[#244052]"][index]}`}>{member}</span>
                  ))}
                </div>
              </div>
            </aside>

            <div className="min-w-0 p-3 sm:p-5">
              <div className="mb-4 rounded-2xl border border-white/10 bg-[#112638] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0878ff] to-cyan-500 text-sm font-bold text-white">N</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-white">{text.project}</h3>
                      <p className="mt-1 text-[10px] text-slate-400">{text.projectDescription}</p>
                    </div>
                  </div>
                  <span className="hidden shrink-0 rounded-full bg-[#0878ff]/10 px-2 py-1 text-[9px] font-semibold text-[#8cff00] sm:inline-flex">{text.joinProject}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["React", "Node.js", "MongoDB"].map((tag) => <span key={tag} className="rounded-full bg-[#0878ff]/10 px-2 py-1 text-[9px] font-semibold text-[#79c9ff]">{tag}</span>)}
                </div>
              </div>

              <div role="tablist" aria-label={text.project} className="mb-4 flex gap-4 overflow-x-auto border-b border-white/10">
                {text.tabs.map(({ id, label }) => (
                  <button key={id} type="button" role="tab" aria-selected={activeTab === id} aria-controls="landing-demo-content" onClick={() => setActiveTab(id)} className={`shrink-0 border-b-2 px-0.5 pb-2 text-[10px] font-semibold transition ${activeTab === id ? "border-[#0878ff] text-[#35b5ff]" : "border-transparent text-slate-500 hover:text-slate-200"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div id="landing-demo-content" role="tabpanel" className="landing-demo-panel">
                {activeTab === "discussion" && (
                  <div className="landing-demo-content space-y-2.5">
                    {text.messages.map((item) => (
                      <div key={item.author} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-[#0f2636] p-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0b2d67] text-[9px] font-bold text-[#a1ff47]">{item.author.split(" ").map((part) => part[0]).join("")}</span>
                        <div className="min-w-0 flex-1 text-[10px] leading-5">
                          <div className="flex justify-between gap-3"><span className="font-bold text-white">{item.author}</span><span className="text-slate-500">{item.time}</span></div>
                          <p className="text-slate-300">{item.text}</p>
                        </div>
                      </div>
                    ))}
                    {sentMessage && <div className="ml-auto max-w-[85%] rounded-xl border border-[#0878ff]/20 bg-[#0878ff]/10 px-3 py-2 text-[10px] leading-5 text-emerald-100">{sentMessage}</div>}
                    <form onSubmit={sendMessage} className="flex gap-2 pt-1">
                      <input value={message} onChange={(event) => setMessage(event.target.value)} aria-label={text.input} placeholder={text.input} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#112638] px-3 py-2 text-[10px] text-white placeholder:text-slate-500 focus:border-[#0878ff] focus:outline-none" />
                      <button type="submit" aria-label={text.send} className="grid h-8 w-9 shrink-0 place-items-center rounded-lg bg-[#0878ff] text-white transition hover:bg-emerald-500"><Send size={13} aria-hidden="true" /></button>
                    </form>
                  </div>
                )}
                {activeTab === "files" && (
                  <div className="landing-demo-content space-y-2">
                    {[["App.tsx", "Updated today"], ["api-client.ts", "Updated yesterday"], ["README.md", "Updated 2 days ago"]].map(([file, updated]) => (
                      <div key={file} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f2636] px-3 py-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0878ff]/10 text-[#35b5ff]"><Code2 size={14} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 text-xs font-medium text-slate-200">{file}</span>
                        <span className="text-[9px] text-slate-500">{updated}</span>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "tasks" && (
                  <div className="landing-demo-content space-y-2">
                    {text.tasks.map((task, index) => (
                      <div key={task} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f2636] px-3 py-3">
                        <span className={`grid h-5 w-5 place-items-center rounded-md border ${index === 0 ? "border-[#0878ff] bg-[#0878ff] text-white" : "border-white/20 text-transparent"}`}>{index === 0 && <Check size={12} aria-hidden="true" />}</span>
                        <span className={`flex-1 text-[10px] ${index === 0 ? "text-slate-500 line-through" : "text-slate-200"}`}>{task}</span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[8px] text-slate-400">{index === 0 ? "Done" : "In progress"}</span>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "poll" && (
                  <div className="landing-demo-content rounded-xl border border-white/[0.06] bg-[#0f2636] p-3.5">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-100"><BarChart3 size={13} className="text-[#35b5ff]" aria-hidden="true" />{text.poll}</div>
                    <div className="space-y-2">
                      {(Object.keys(votes) as PollOption[]).map((option) => {
                        const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
                        const percentage = Math.round((votes[option] / total) * 100);
                        return (
                          <button key={option} type="button" onClick={() => castVote(option)} aria-pressed={votedOption === option} className={`w-full rounded-lg border p-2 text-left transition ${votedOption === option ? "border-[#0878ff]/70 bg-[#0878ff]/10" : "border-white/[0.06] bg-[#142d3f] hover:border-white/20"}`}>
                            <span className="mb-1 flex justify-between text-[9px] font-semibold text-slate-300"><span>{option === "Other" ? (locale === "fr" ? "Autre" : "Other") : option}</span><span>{percentage}%</span></span>
                            <span className="block h-1 overflow-hidden rounded-full bg-slate-700"><span className={`block h-full rounded-full transition-all duration-500 ${votedOption === option ? "bg-[#0878ff]" : "bg-slate-500"}`} style={{ width: `${percentage}%` }} /></span>
                          </button>
                        );
                      })}
                    </div>
                    <p aria-live="polite" className="mt-3 text-center text-[9px] font-medium text-[#35b5ff]">{votedOption ? text.voted : text.vote}</p>
                  </div>
                )}
              </div>
            </div>

            <aside className="hidden border-l border-white/10 bg-[#091824] p-4 lg:block">
              <div className="rounded-2xl border border-white/10 bg-[#0f2636] p-3.5">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-white"><BarChart3 size={13} className="text-[#0878ff]" aria-hidden="true" />{text.tabs[3].label}</div>
                <p className="mb-3 text-[10px] leading-4 text-slate-300">{text.poll}</p>
                <div className="space-y-2">
                  {(["React", "Vue", "Angular", "Other"] as PollOption[]).slice(0, 3).map((option) => {
                    const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
                    return <div key={option} className="rounded-lg border border-white/[0.06] bg-[#142d3f] px-2 py-1.5 text-[9px] text-slate-300"><span className="flex justify-between"><span>{option}</span><span>{Math.round(votes[option] / total * 100)}%</span></span></div>;
                  })}
                </div>
                <button type="button" onClick={() => setActiveTab("poll")} className="mt-3 w-full rounded-lg bg-[#0a58ca] py-1.5 text-[9px] font-bold text-white transition hover:bg-blue-600">{text.vote}</button>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">{text.online}</p>
                <div className="flex -space-x-2">
                  {["AL", "MC", "JS", "NK"].map((member, index) => <span key={member} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[#091824] text-[8px] font-bold text-white ${["bg-[#0878ff]", "bg-[#b17664]", "bg-[#697fa6]", "bg-[#937b49]"][index]}`}>{member}</span>)}
                  <span className="ml-3 self-center text-[9px] text-[#8cff00]">+3</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {text.features.map(({ title, description, icon: Icon }, index) => (
            <article key={title} data-landing-reveal="up" className="landing-demo-feature flex items-start gap-4 rounded-2xl border border-[#d8e2f2] bg-white p-5 shadow-[0_12px_40px_rgba(20,55,67,0.04)]">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-blue-50 text-blue-700" : index === 1 ? "bg-sky-50 text-sky-600" : "bg-lime-50 text-lime-700"}`}><Icon size={18} aria-hidden="true" /></span>
              <div><h3 className="text-sm font-semibold text-[#10224c]">{title}</h3><p className="mt-1.5 text-xs leading-5 text-[#586b8c]">{description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
