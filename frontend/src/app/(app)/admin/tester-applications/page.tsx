import { redirect } from "next/navigation";

export default function AdminTesterApplicationsRedirect() {
  redirect("/admin?section=tester-applications");
}
