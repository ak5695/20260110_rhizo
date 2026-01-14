"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlist } from "@/actions/waitlist";
import { toast } from "sonner";
import { ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaitlistFormProps {
    className?: string;
    variant?: "default" | "minimal";
}

export const WaitlistForm = ({ className, variant = "default" }: WaitlistFormProps) => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        try {
            const result = await joinWaitlist(email);
            if (result.success) {
                setIsSuccess(true);
                toast.success("You've joined the waitlist!");
                setEmail("");
            } else {
                toast.error(result.error || "Failed to join");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className={cn("flex items-center gap-x-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/20 animate-in fade-in slide-in-from-bottom-2", className)}>
                <Check className="h-4 w-4" />
                <span className="font-medium">You're on the list! Watch your inbox.</span>
            </div>
        );
    }

    if (variant === "minimal") {
        return (
            <form onSubmit={handleSubmit} className={cn("flex w-full max-w-sm items-center space-x-2", className)}>
                <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-9 w-[200px]"
                />
                <Button type="submit" size="sm" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Waitlist"}
                </Button>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit} className={cn("flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mx-auto", className)}>
            <div className="relative w-full">
                <Input
                    type="email"
                    placeholder="name@company.com"
                    className="h-12 w-full bg-background/50 backdrop-blur-sm border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 transition-all font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                />
            </div>
            <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full sm:w-auto h-12 px-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 transition-all"
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        Join Waitlist <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                )}
            </Button>
        </form>
    );
};
