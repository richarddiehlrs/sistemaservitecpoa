import { redirect } from "next/navigation";
import { getRole } from "@/lib/config";

export default async function Home() {
  const role = await getRole();
  redirect(role === "tecnico" ? "/campo" : "/dashboard");
}
