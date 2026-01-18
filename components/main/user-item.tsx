"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { ChevronsLeftRight } from "lucide-react";

export const UserItem = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const onSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Explicitly clear any client-side session state if needed
            // router.push("/") will be handled by the layout redirect when session becomes null
            // router.refresh();
          },
          onError: (ctx) => {
            console.error("Sign out failed:", ctx.error);
            toast.error("Sign out failed. Please try again.");
            // Fallback: force redirect to home
            window.location.href = "/";
          }
        },
      });
    } catch (error) {
      console.error("Catch sign out error:", error);
      window.location.href = "/";
    }
  }

  // Generate pixel-art avatar URL if no user image is present
  const avatarUrl = session?.user?.image || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(session?.user?.name || "User")}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          role="button"
          className="flex items-center text-[13px] px-2 py-1.5 w-full hover:bg-primary/5 rounded-sm pr-8"
        >
          <div className="gap-x-1.5 flex items-center flex-1 min-w-0">
            <Avatar className="h-4 w-4 rounded-md">
              <AvatarImage src={avatarUrl} />
            </Avatar>
            <span className="text-start font-medium line-clamp-1 truncate">
              {session?.user?.name}&apos;s Rhizo
            </span>
          </div>
          <ChevronsLeftRight className="rotate-90 ml-1.5 text-muted-foreground h-3 w-3 shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80"
        align="start"
        alignOffset={11}
        forceMount
      >
        <div className="flex flex-col space-y-4 p-2">
          <p className="text-xs font-medium leading-none text-muted-foreground">
            {session?.user?.email}
          </p>
          <div className="flex items-center gap-x-2">
            <div className="rounded-md bg-secondary p-1">
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarImage src={avatarUrl} />
              </Avatar>
            </div>
            <div className="space-y-1">
              <p className="text-sm line-clamp-1">
                {session?.user?.name}&apos;s Rhizo
              </p>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="w-full cursor-pointer text-orange-600 dark:text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 focus:text-orange-700 focus:bg-orange-50 dark:focus:bg-orange-950/20"
          onClick={onSignOut}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent >
    </DropdownMenu >
  );
};
