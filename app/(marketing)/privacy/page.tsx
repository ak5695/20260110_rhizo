"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
    const router = useRouter();

    return (
        <div className="min-h-full flex flex-col dark:bg-[#1F1F1F]">
            <div className="max-w-3xl mx-auto px-6 py-6 w-full">
                <Button
                    onClick={() => router.back()}
                    variant="ghost"
                    size="sm"
                    className="mb-8 gap-x-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>

                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-black/5 dark:border-white/5 rounded-3xl p-8 md:p-12 shadow-xl">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>

                    <div className="space-y-6 text-muted-foreground leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
                            <p>
                                We collect information you provide directly to us, such as when you create an account, create or edit documents, or communicate with us. This includes your name, email address, and the content you store in Rhizo.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
                            <p>
                                We use the information we collect to provide, maintain, and improve our services, to develop new ones, and to protect Rhizo and our users.
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Provide and deliver the services you requests;</li>
                                <li>Send you technical notices and support messages;</li>
                                <li>Respond to your comments and questions;</li>
                                <li>Monitor and analyze trends, usage, and activities.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Security</h2>
                            <p>
                                We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">4. Cookies</h2>
                            <p>
                                Most web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove or reject browser cookies.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">5. Third-Party Services</h2>
                            <p>
                                We may use third-party services (like authentication providers) that collect information used to identify you. These services have their own privacy policies.
                            </p>
                        </section>
                    </div>

                    <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 text-sm text-muted-foreground">
                        Last updated: January 18, 2026
                    </div>
                </div>
            </div>
        </div>
    );
}
