import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthPage from "../components/Auth/AuthPage.tsx";
import * as auth from "../api/auth";

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(undefined);
        setIsSubmitting(true);

        try {
            const response = await auth.signIn.email({
                email,
                password,
                callbackURL: "/dashboard",
            });

            if (response.error) {
                setErrorMessage(response.error.message || "Unable to sign in.");
                return;
            }

            navigate("/dashboard", { replace: true });
        } catch {
            setErrorMessage("Unable to sign in right now. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <AuthPage
            mode="login"
            email={email}
            password={password}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
        />
    );
}
