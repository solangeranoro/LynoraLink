"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, UsersRound, X } from "@/components/FontAwesomeIcons";
import Link from "next/link";
import TeamLogoUploadModal from "@/components/TeamLogoUploadModal";
import { useTranslation } from "@/lib/i18n";

const TEAM_ROLES = ["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"] as const;

export default function NewTeamPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [description, setDescription] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { id: "identity", label: "Identité", caption: "Nom et vision de l’équipe" },
    { id: "team", label: "Équipe", caption: "Compétences recherchées" },
  ];

  const completion = Math.min(
    100,
    Math.round(
      (([name, mission, description].filter(Boolean).length / 3) * 70 +
        (lookingFor.length > 0 ? 30 : 0))
    )
  );

  const canContinue = () => {
    if (currentStep === 0) return name.trim() && mission.trim() && description.trim();
    return lookingFor.length > 0;
  };

  const isStepAccessible = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return name.trim() && mission.trim() && description.trim();
    return false;
  };

  const goToNextStep = () => {
    if (currentStep < steps.length - 1 && canContinue()) {
      setCurrentStep((step) => step + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((step) => step - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index === currentStep || !isStepAccessible(index)) return;
    if (index < currentStep || isStepAccessible(index)) {
      setCurrentStep(index);
    }
  };

  function toggleRole(role: string) {
    setLookingFor((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role]);
  }

  async function createTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: name.trim(),
          tagline: mission.trim(),
          teamDescription: description.trim(),
          logoUrl,
          lookingFor,
        }),
      });
      if (!response.ok) throw new Error("team_create_failed");
      router.push("/teams");
      router.refresh();
    } catch {
      setError(t("teams.createError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] max-w-none space-y-4 sm:mx-auto sm:w-full sm:max-w-xl sm:space-y-5">
      <Link href="/teams" className="mx-4 inline-flex min-h-9 items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink sm:mx-0">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("teams.title")}
      </Link>

      <header className="mx-4 flex flex-col gap-3 sm:mx-0 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-soft">{t("teams.newTitle")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink sm:text-3xl">
            <UsersRound className="h-6 w-6 text-gold-soft" aria-hidden="true" />
            {t("teams.newTitle")}
          </h1>
        </div>
        <div className="rounded-full border border-midnight-border bg-midnight-card/60 px-3 py-1.5 text-xs text-ink-muted">
          {completion}% complete
        </div>
      </header>

      <div className="card mx-4 !rounded-[20px] p-2.5 sm:mx-0">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => {
            const active = index === currentStep;
            const done = index < currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(index)}
                disabled={!isStepAccessible(index) || index > currentStep}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-2.5 py-2 text-[11px] font-medium transition ${
                  active
                    ? "border-gold/60 bg-gold/10 text-ink"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-midnight-border bg-midnight-deep/35 text-ink-muted hover:border-gold/40 hover:text-ink"
                } ${!isStepAccessible(index) || index > currentStep ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">{index + 1}</span>
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={createTeam} className="card block w-full overflow-hidden rounded-none sm:rounded-[24px]">
        <div className="border-b border-midnight-border bg-midnight-deep/25 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-soft">{t("teams.identityTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("teams.identityHint")}</p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-none border-y border-midnight-border bg-midnight-deep/20 p-4 sm:rounded-[22px] sm:border sm:p-5">
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-midnight-border pb-3">
                  <div className="text-[11px] font-medium text-ink-muted">Informations de base</div>
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-midnight-border bg-midnight-card text-gold-soft">
                    {logoUrl ? <img src={logoUrl} alt={t("teams.avatarPreview")} className="h-full w-full object-cover" /> : <UsersRound size={18} aria-hidden="true" />}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="team-name" className="label">{t("teams.name")}</label>
                    <input id="team-name" required minLength={3} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="input" autoComplete="organization" placeholder={t("teams.namePlaceholder")} />
                    <p className="mt-1 text-right text-[11px] text-ink-muted">{name.length}/100</p>
                  </div>

                  <div>
                    <label htmlFor="team-mission" className="label">{t("teams.mission")}</label>
                    <input id="team-mission" required minLength={5} maxLength={160} value={mission} onChange={(event) => setMission(event.target.value)} className="input" placeholder={t("teams.missionPlaceholder")} />
                    <p className="mt-1 text-right text-[11px] text-ink-muted">{mission.length}/160</p>
                  </div>

                  <div>
                    <label htmlFor="team-description" className="label">{t("teams.description")}</label>
                    <textarea id="team-description" required minLength={20} maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="input resize-y" placeholder={t("teams.descriptionPlaceholder")} />
                    <p className="mt-1 text-right text-[11px] text-ink-muted">{description.length}/5000</p>
                  </div>

                  <div className="rounded-2xl border border-midnight-border bg-midnight-deep/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-ink">Logo de l’équipe</p>
                        <p className="mt-1 text-[11px] text-ink-muted">{t("teams.avatarHint")}</p>
                      </div>
                      <button type="button" onClick={() => setLogoModalOpen(true)} className="btn-ghost !min-h-8 !rounded-lg !px-2.5 !py-1.5 text-[11px]">
                        {logoUrl ? <Camera size={13} aria-hidden="true" /> : <ImagePlus size={13} aria-hidden="true" />}
                        {logoUrl ? t("teams.changeAvatar") : t("teams.addAvatar")}
                      </button>
                    </div>
                    {logoUrl && (
                      <button type="button" onClick={() => setLogoUrl("")} className="mt-2 text-[11px] text-ink-muted hover:text-ink">
                        <X size={12} className="mr-1 inline" aria-hidden="true" />{t("teams.removeAvatar")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="border-b border-midnight-border pb-3">
                  <p className="text-[11px] font-medium text-ink-muted">Profil recherché</p>
                </div>

                <fieldset>
                  <legend className="sr-only">{t("teams.roles")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TEAM_ROLES.map((role) => {
                      const selected = lookingFor.includes(role);
                      return (
                        <label key={role} className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-sm transition ${selected ? "border-gold/50 bg-gold/10 text-ink" : "border-midnight-border bg-midnight-deep/30 text-ink-muted hover:border-gold/40 hover:text-ink"}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleRole(role)} className="h-4 w-4 accent-gold" />
                          <span className="flex-1">{t(`projects.roles.${role}`)}</span>
                          {selected && <Check size={13} className="text-gold-soft" aria-hidden="true" />}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-midnight-border pt-4">
            <div className="text-[11px] text-ink-muted">{currentStep + 1} / {steps.length}</div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button type="button" onClick={goToPreviousStep} className="btn-ghost !min-h-8 !rounded-lg !px-3 !py-1.5 text-xs">
                  Précédent
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button type="button" onClick={goToNextStep} disabled={!canContinue()} className="btn-gold !min-h-8 !rounded-lg !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50">
                  Suivant
                </button>
              ) : (
                <button type="submit" disabled={loading || !canContinue()} className="btn-gold !min-h-8 !rounded-lg !px-3 !py-1.5 text-xs">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />}
                  {t("teams.submit")}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
      <TeamLogoUploadModal
        open={logoModalOpen}
        currentImage={logoUrl}
        onClose={() => setLogoModalOpen(false)}
        onUploaded={setLogoUrl}
      />
    </div>
  );
}