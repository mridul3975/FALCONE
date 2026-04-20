import { betterAuth } from "better-auth";
import db from "../db/connection";
import { bearer } from "better-auth/plugins/bearer";
import { networkInterfaces } from "node:os";

const DEV_CLIENT_PORTS = [3000, 4173, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];

function getLocalIPv4Hosts(): string[] {
    const interfaces = networkInterfaces();
    const hosts: string[] = [];

    for (const netInterface of Object.values(interfaces)) {
        for (const net of netInterface ?? []) {
            if (net.family === "IPv4" && !net.internal) {
                hosts.push(net.address);
            }
        }
    }

    return hosts;
}

const defaultHosts = ["localhost", "127.0.0.1", ...getLocalIPv4Hosts()];
const defaultTrustedOrigins = defaultHosts.flatMap((host) =>
    DEV_CLIENT_PORTS.map((port) => `http://${host}:${port}`),
);

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

