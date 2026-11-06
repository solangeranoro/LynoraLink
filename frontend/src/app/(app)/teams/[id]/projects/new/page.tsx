"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "@/components/FontAwesomeIcons";
import { ProjectCreateForm, type CreatedProject } from "@/components/ProjectCreateForm";
import { useTranslation } from "@/lib/i18n";

type TeamSummary = { id: string; teamName: string | null; title: string; logoUrl: string | null };

export default function NewTeamProjectPage() {
  const { locale } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: team, isLoading, isError } = useQuery({
    queryKey: ["team-project-create", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${params.id}`);
      if (!response.ok) throw new Error("team_load_failed");
      const result = await response.json() as { team: TeamSummary };
      return result.team;
    },
  });

  function handleCreated(project: CreatedProject, accountSuspended?: boolean, teamApprovalRequired?: boolean) {
    if (accountSuspended) {
      router.replace("/account-status");
      return;
    }
    router.push(teamApprovalRequired ? `/teams/${team?.id}/manage` : `/projects/${project.id}`);
    router.refresh();
  }

  if (isLoading) {
    return <div className="mx-auto max-w-2xl space-y-4" aria-busy="true"><div className="skeleton h-8 w-64" /><div className="skeleton h-48 rounded-xl" /></div>;
  }

  if (isError || !team) {
    return <p role="alert" className="mx-auto max-w-2xl card p-5 text-sm text-rose-300">{locale === "fr" ? "Impossible de charger l’équipe." : "Couldn't load the team."}</p>;
  }

  const teamName = team.teamName?.trim() || team.title;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={`/teams/${team.id}`} className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" />{teamName}
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{locale === "fr" ? "Projet d’équipe" : "Team project"}</p>
        <h1 className="section-title mt-1">{locale === "fr" ? "Créer un projet" : "Create a project"}</h1>
        <p className="mt-1 text-sm text-ink-muted">{locale === "fr" ? `Le projet sera rattaché à l’équipe ${teamName}.` : `This project will be added to the ${teamName} team.`}</p>
      </header>
      <ProjectCreateForm parentTeamId={team.id} parentTeamName={teamName} parentTeamImage={team.logoUrl} onCreated={handleCreated} />
    </div>
  );
}
