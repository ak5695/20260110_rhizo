"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Spinner } from "@/components/spinner";
import Link from "next/link";

export const Heading = () => {
  const { data: session, isPending: isLoading } = authClient.useSession();

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">
        Rooted Knowledge, Connected Thought. This is{" "}
        <span className="underline">Rhizo</span>
      </h1>
      <h3 className="text-base sm:text-xl md:text-2xl font-medium">
        Rhizo is the connected workspace where <br />
        ideas grow and connect organically.
      </h3>
      {isLoading && (
        <div className="w-full flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}
      {!session && !isLoading && (
        <Button asChild size="lg" className="mt-8 md:mt-10">
          <Link href="/sign-up">
            Get Started Free <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      )}
      {session && !isLoading && (
        <Button asChild>
          <Link href="/documents">
            Enter Rhizo <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      )}
    </div>
  );
};
