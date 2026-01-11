"use client";
import { UseScrollTop } from "@/hooks/use-scroll-top";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/marketing/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import Link from "next/link";
import { UserItem } from "@/components/main/user-item";

export const Navbar = () => {
  const { data: session, isPending: isLoading } = authClient.useSession();
  const scrolled = UseScrollTop();
  return (
    <div
      className={cn(
        "z-50 bg-background dark:bg-[#1F1F1F] fixed top-0 flex items-center w-full p-6",
        scrolled && "border-b shadow-sm",
      )}
    >
      <Logo />
      <div className="md:ml-auto md:justify-end justify-between w-full flex items-center gap-x-2">
        {isLoading && <Spinner />}
        {!session && !isLoading && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Get Jotion free</Link>
            </Button>
          </>
        )}
        {session && !isLoading && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents">Enter Jotion</Link>
            </Button>
            <UserItem />
          </>
        )}
        <ModeToggle />
      </div>
    </div>
  );
};
