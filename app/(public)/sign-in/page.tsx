"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { getRedirectUrl } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialButton } from "@/components/auth/social-button";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);
    const router = useRouter();

    const signInWithEmail = async () => {
        if (!email || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        setLoading(true);
        const { data, error } = await authClient.signIn.email({
            email,
            password,
        });

        if (data) {
            toast.success("Welcome back!");
            try {
                const url = await getRedirectUrl();
                router.push(url);
            } catch (error) {
                router.push("/documents");
            }
            router.refresh();
        }
        if (error) {
            toast.error(error.message || "Invalid credentials");
            setLoading(false);
        }
    };

    const signInWithSocial = async (provider: "google" | "github") => {
        setSocialLoading(provider);
        try {
            await authClient.signIn.social({
                provider,
                callbackURL: "/documents",
            });
        } catch (error) {
            toast.error(`Failed to sign in with ${provider}`);
            setSocialLoading(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            signInWithEmail();
        }
    };

    return (
        <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4 overflow-hidden">
            {/* Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Main Card */}
                <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/20 p-8">
                    {/* Back Button */}
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>

                    {/* Header - Larger Logo */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-background border border-border/50 mb-4 overflow-hidden shadow-lg">
                            <Image
                                src="/logo.png"
                                alt="Rhizo"
                                width={64}
                                height={64}
                                className="dark:hidden"
                            />
                            <Image
                                src="/logo-dark.png"
                                alt="Rhizo"
                                width={64}
                                height={64}
                                className="hidden dark:block"
                            />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Sign in to continue to Rhizo
                        </p>
                    </div>

                    {/* Social Login - Side by Side */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <SocialButton
                            provider="google"
                            onClick={() => signInWithSocial("google")}
                            disabled={!!socialLoading || loading}
                        />
                        <SocialButton
                            provider="github"
                            onClick={() => signInWithSocial("github")}
                            disabled={!!socialLoading || loading}
                        />
                    </div>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/50" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-3 text-muted-foreground">
                                Or with email
                            </span>
                        </div>
                    </div>

                    {/* Email Form */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-medium">
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading || !!socialLoading}
                                className="h-10 bg-background/50 border-border/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-medium">
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={loading || !!socialLoading}
                                    className="h-10 bg-background/50 border-border/50 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <Button
                            onClick={signInWithEmail}
                            disabled={loading || !!socialLoading}
                            className="w-full h-11 text-sm font-medium"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </Button>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-sm text-muted-foreground mt-5">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/sign-up"
                            className="text-primary hover:underline font-medium"
                        >
                            Sign up
                        </Link>
                    </p>
                </div>

                {/* Legal Text */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                    By signing in, you agree to our{" "}
                    <Link href="#" className="underline hover:text-foreground">
                        Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="underline hover:text-foreground">
                        Privacy
                    </Link>
                </p>
            </div>
        </div>
    );
}
