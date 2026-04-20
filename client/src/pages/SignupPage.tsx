import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthPage from "../components/Auth/AuthPage.tsx";
import * as auth from "../api/auth";

export default function SignupPage() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage(undefined);

        if (name.trim().length < 2) {
            setErrorMessage("Please enter a valid name.");
            return;
        }

        if (password.length < 8) {
            setErrorMessage("Password must be at least 8 characters.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await auth.signUp.email({
                name: name.trim(),
                email,
                password,
                callbackURL: "/dashboard",
            });

            if (response.error) {
                setErrorMessage(response.error.message || "Unable to create account.");
                return;
            }

            navigate("/dashboard", { replace: true });
        } catch {
            setErrorMessage("Unable to sign up right now. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <AuthPage
            mode="signup"
            name={name}
            email={email}
            password={password}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onNameChange={setName}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
        />
    );
}
