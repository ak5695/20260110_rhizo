"use client";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { create } from "@/actions/documents";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function DocumentPage() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const onCreate = () => {
    const promise = create({ title: "Untitled" }).then((document) =>
      router.push(`/documents/${document.id}`),
    );

    toast.promise(promise, {
      loading: "Creating a new note...",
      success: "New note created",
      error: "Failed to create new note",
    });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-4 ">
      <Image
        src="/empty.png"
        alt="empty"
        height="300"
        width="300"
        className="dark:hidden"
      />
      <Image
        src="/empty-dark.png"
        alt="empty"
        height="300"
        width="300"
        className="hidden dark:block"
      />
      <h2 className="text-lg font-medium">
        Welcome to {session?.user?.name}&apos;s Jotion
      </h2>
      <Button onClick={onCreate}>
        <PlusCircle className="h-4 w-4 mr-2" />
        Create a note
      </Button>
    </div>
  );
}
