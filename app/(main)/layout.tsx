"use client";

import { authClient } from "@/lib/auth-client";
import { Spinner } from "@/components/spinner";
import { redirect } from "next/navigation";
import { Navigation } from "@/components/main/navigation";
import { SearchCommand } from "@/components/search-command";
import React from "react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending: isLoading } = authClient.useSession();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return redirect("/");
  }

  return (
    <div className="h-full flex dark:bg-[#1F1F1F]">
      <Navigation />
      <main className="flex-1 h-full overflow-y-auto">
        <SearchCommand />
        {children}
      </main>
    </div>
  );
}
