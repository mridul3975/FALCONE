import { createAuthClient } from "better-auth/react";

const authBaseURL =
    import.meta.env.VITE_AUTH_BASE_URL ??
    `${window.location.protocol}//${window.location.hostname}:3000`;

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