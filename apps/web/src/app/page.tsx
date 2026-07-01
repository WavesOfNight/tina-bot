import { redirect } from "next/navigation";
import { hasAdminUser } from "@tina/database";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await hasAdminUser())) {
    redirect("/setup");
  }

  const session = await auth();
  redirect(session ? "/dashboard" : "/login");
}
