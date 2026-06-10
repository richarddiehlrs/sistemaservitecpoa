import { redirect } from "next/navigation";
import { getRole } from "@/lib/config";
import { homePorPapel } from "@/lib/permissoes";

export default async function Home() {
  const role = await getRole();
  redirect(homePorPapel(role));
}
