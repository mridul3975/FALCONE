import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000"
});

// We can export useful hooks directly
export const { signIn, signUp, signOut, useSession } = authClient;