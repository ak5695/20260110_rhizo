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
        Your Ideas, Documents, & plans, Unified, welcome to{" "}
        <span className="underline">Jotion</span>
      </h1>
      <h3 className="text-base sm:text-xl md:text-2xl font-medium">
        Jotion is the connected workspace where <br />
        better, faster work happens
      </h3>
      {isLoading && (
        <div className="w-full flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}
      {!session && !isLoading && (
        <Button size="sm" asChild>
          <Link href="/sign-in">
            Get Jotion free <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      )}
      {session && !isLoading && (
        <Button asChild>
          <Link href="/documents">
            Enter Jotion <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      )}
    </div>
  );
};
