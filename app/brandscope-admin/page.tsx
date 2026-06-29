import { redirect } from "next/navigation";

// /brandscope-admin → System Health is the internal landing surface.
export default function InternalAdminIndex() {
  redirect("/brandscope-admin/health");
}
