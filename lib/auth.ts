import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "github", "notion"],
            allowDifferentEmails: true,
        }
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
        notion: {
            clientId: process.env.NOTION_CLIENT_ID as string,
            clientSecret: process.env.NOTION_CLIENT_SECRET as string,
        },
    },
    logger: {
        level: "debug",
    },
    trustedOrigins: [
        process.env.BETTER_AUTH_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        "https://rhizo.dufran.cn",
        "http://localhost:3000",
    ].filter((url): url is string => !!url),
});

