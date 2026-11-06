import { redirect } from "next/navigation";

export default function AdminModerationRedirect() {
  redirect("/admin?section=moderation");
}
