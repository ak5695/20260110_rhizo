import { redirect } from "next/navigation";
import { create, getLastActive } from "@/actions/documents";

export const dynamic = "force-dynamic";

export default async function DocumentPage() {
  // 1. Check for last active document
  const lastActive = await getLastActive();

  if (lastActive) {
    return redirect(`/documents/${lastActive.id}`);
  }

  // 2. No documents? Create one.
  const newDoc = await create({ title: "Untitled" });
  return redirect(`/documents/${newDoc.id}`);
}
