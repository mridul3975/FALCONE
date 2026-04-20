import { betterAuth } from "better-auth";
import db from "../db/connection";
import { bearer } from "better-auth/plugins/bearer";

export const auth = betterAuth({
    database: db,
    baseURL: "http://localhost:3000",
    emailAndPassword: {
        enabled: true,
    },
    plugins: [bearer()],
    trustedOrigins: ["http://localhost:3000"],
});

