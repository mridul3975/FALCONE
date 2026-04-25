import { createAuthClient } from "better-auth/react";

const authBaseURL =
    (import.meta as ImportMeta & { env: { VITE_AUTH_BASE_URL?: string } }).env
        .VITE_AUTH_BASE_URL ??
    `${(globalThis as typeof globalThis & {
        location?: { protocol: string; hostname: string };
    }).location?.protocol ?? "http:"}//${(globalThis as typeof globalThis & {
        location?: { protocol: string; hostname: string };
    }).location?.hostname ?? "localhost"}:3000`;

export const authClient = createAuthClient({
    baseURL: authBaseURL,
    fetchOptions: {
        auth: {
            type: "Bearer",
            token: () => localStorage.getItem("bearer_token") ?? "",
        },
        onSuccess: (context) => {
            const authToken = context.response.headers.get("set-auth-token");

            if (authToken) {
                localStorage.setItem("bearer_token", authToken);
            }
        },
    },
});

// We can export useful hooks directly
export const { signIn, signUp, signOut, useSession } = authClient;

export const getBearerToken = () => localStorage.getItem("bearer_token");

export const signInWithGoogle = async () => {
    await signIn.social({
        provider: "google",
        callbackURL: "http://localhost:5173/dashboard",
    });
};