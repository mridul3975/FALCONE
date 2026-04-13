import { betterAuth } from "better-auth";
import db from "../db/connection";

export const auth = betterAuth({
    database: db,
    emailAndPassword: {
        enabled: true,
    },
    trustedOrigins: ["http://localhost:3000"],
});

