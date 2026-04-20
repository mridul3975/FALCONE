import { betterAuth } from "better-auth";
import db from "../db/connection";
import { bearer } from "better-auth/plugins/bearer";

const defaultTrustedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
];

const envTrustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const trustedOrigins = Array.from(new Set([...defaultTrustedOrigins, ...envTrustedOrigins]));

export const auth = betterAuth({
    database: db,
    baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:3000",
    emailAndPassword: {
        enabled: true,
    },
    plugins: [bearer()],
    trustedOrigins,
});

