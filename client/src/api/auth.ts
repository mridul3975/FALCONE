import { createAuthClient } from "better-auth/react";

const authBaseURL =
    import.meta.env.VITE_AUTH_BASE_URL ??
    `${window.location.protocol}//${window.location.hostname}:3000`;

export const authClient = createAuthClient({
    baseURL: authBaseURL,
});

// We can export useful hooks directly
export const { signIn, signUp, signOut, useSession } = authClient;