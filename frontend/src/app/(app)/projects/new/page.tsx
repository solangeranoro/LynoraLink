"use client";

import { useRouter } from "next/navigation";
import { ProjectCreateForm, type CreatedProject } from "@/components/ProjectCreateForm";
import { useTranslation } from "@/lib/i18n";

export default function NewProjectPage() {
  const { t } = useTranslation();
  const router = useRouter();

  function handleCreated(_project: CreatedProject) {
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="section-title">{t("projects.newProject")}</h1>
      <ProjectCreateForm onCreated={handleCreated} />
    </div>
  );
}
