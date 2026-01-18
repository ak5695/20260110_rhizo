"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialButton } from "@/components/auth/social-button";
import { Loader2, Eye, EyeOff, ArrowLeft, Shield, CheckCircle2 } from "lucide-react";

export default function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState<"google" | "github" | "notion" | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileLoading, setTurnstileLoading] = useState(true);
    const turnstileRef = useRef<TurnstileInstance>(null);
    const router = useRouter();

    const signUpWithEmail = async () => {
        if (!name || !email || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        if (!turnstileToken) {
            toast.error("Please wait for verification to complete");
            return;
        }

        setLoading(true);

        const { data, error } = await authClient.signUp.email({
            email,
            password,
            name,
        });

        if (data) {
            toast.success("Account created!");
            router.push("/documents");
        }
        if (error) {
            toast.error(error.message || "Failed to create account");
            turnstileRef.current?.reset();
            setTurnstileToken(null);
            setTurnstileLoading(true);
        }
        setLoading(false);
    };

    const signUpWithSocial = async (provider: "google" | "github" | "notion") => {
        // Detect restricted WebView environment (disallowed_useragent)
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isWebView = /MicroMessenger|QQ\/|Alipay|DingTalk|TikTok|WeiBo|InsideApp/i.test(ua);

        if (provider === "google" && isWebView) {
            toast.error("Google 注册受限", {
                description: "当前 App 内置浏览器不符合 Google 安全政策。请点击右上角【...】选择“在浏览器中打开”后再尝试登录。",
                duration: 6000,
            });
            return;
        }

        setSocialLoading(provider);
        try {
            await authClient.signIn.social({
                provider,
                callbackURL: "/documents",
            });
        } catch (error) {
            toast.error(`Failed to sign up with ${provider}`);
            setSocialLoading(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            signUpWithEmail();
        }
    };

    return (
        <div className="h-[100dvh] flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4 overflow-hidden">
            {/* Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Main Card */}
                <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/20 p-2">
                    {/* Back Button */}
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
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
                        <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Get started with Rhizo
                        </p>
                    </div>

                    {/* Social Login - Three columns */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <SocialButton
                            provider="google"
                            onClick={() => signUpWithSocial("google")}
                            disabled={!!socialLoading || loading}
                        />
                        <SocialButton
                            provider="github"
                            onClick={() => signUpWithSocial("github")}
                            disabled={!!socialLoading || loading}
                        />
                        <SocialButton
                            provider="notion"
                            onClick={() => signUpWithSocial("notion")}
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

                    {/* Email Form - Vertical Layout */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-sm font-medium">
                                Full Name
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading || !!socialLoading}
                                className="h-10 bg-background/50 border-border/50"
                            />
                        </div>

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
                                    placeholder="At least 8 characters"
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

                        {/* Turnstile - Hidden/Managed Mode with Custom UI */}
                        <div className="hidden">
                            <Turnstile
                                ref={turnstileRef}
                                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                                onSuccess={(token) => {
                                    setTurnstileToken(token);
                                    setTurnstileLoading(false);
                                }}
                                onError={() => {
                                    toast.error("Verification failed");
                                    setTurnstileToken(null);
                                    setTurnstileLoading(false);
                                }}
                                onExpire={() => {
                                    setTurnstileToken(null);
                                    setTurnstileLoading(true);
                                }}
                                options={{
                                    theme: "auto",
                                    size: "invisible",
                                }}
                            />
                        </div>

                        {/* Custom Verification Status */}
                        <div className="flex items-center justify-center gap-2 py-1 text-sm">
                            {turnstileLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-muted-foreground">Verifying...</span>
                                </>
                            ) : turnstileToken ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className="text-emerald-500">Verified</span>
                                </>
                            ) : (
                                <>
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Protected by Cloudflare</span>
                                </>
                            )}
                        </div>

                        <Button
                            onClick={signUpWithEmail}
                            disabled={loading || !!socialLoading || !turnstileToken}
                            className="w-full h-11 text-sm font-medium bg-emerald-600 hover:bg-emerald-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                "Create account"
                            )}
                        </Button>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-sm text-muted-foreground mt-5">
                        Already have an account?{" "}
                        <Link
                            href="/sign-in"
                            className="text-primary hover:underline font-medium"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Legal Text */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                    By signing up, you agree to our{" "}
                    <Link href="/terms" className="underline hover:text-foreground">
                        Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline hover:text-foreground">
                        Privacy
                    </Link>
                </p>
            </div>
        </div>
    );
}
