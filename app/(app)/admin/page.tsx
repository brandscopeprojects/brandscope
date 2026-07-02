import { redirect } from "next/navigation";

// /admin has no content of its own — land on the first Brand Admin tab.
export default function AdminIndex() {
  redirect("/admin/settings");
}
