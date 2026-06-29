import { redirect } from "next/navigation";

// Root: send users into the app. Middleware bounces unauthenticated
// users from /dashboard to /login.
export default function Home() {
  redirect("/dashboard");
}
