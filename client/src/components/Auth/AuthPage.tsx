import type { FormEventHandler } from "react";
import { Link } from "react-router-dom";

type AuthMode = "login" | "signup";

type AuthPageProps = {
    mode: AuthMode;
    name?: string;
    email: string;
    password: string;
    isSubmitting: boolean;
    errorMessage?: string;
    onNameChange?: (value: string) => void;
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: FormEventHandler<HTMLFormElement>;
};

const isLogin = (mode: AuthMode) => mode === "login";

export default function AuthPage({
    mode,
    name,
    email,
    password,
    isSubmitting,
    errorMessage,
    onNameChange,
    onEmailChange,
    onPasswordChange,
    onSubmit,
}: AuthPageProps) {
    const loginMode = isLogin(mode);

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#05070B] text-[#E9EDF8]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_45%_at_50%_0%,rgba(48,93,161,0.18)_0%,rgba(5,7,11,0)_65%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-60 [background:linear-gradient(120deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_30%,rgba(255,255,255,0.03)_60%,rgba(255,255,255,0)_100%)]" />

            <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8 sm:px-8">
                <header className="mb-8 flex items-center justify-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#244A84] bg-[#0A1221] text-[13px] font-semibold text-[#6EA6FF]">
                        M
                    </span>
                    <span className="font-serif text-[34px] font-semibold italic tracking-[0.16em] text-[#FFF8E6]">
                        CHATRIX
                    </span>
                </header>

                <div className="rounded-[32px] border border-[#1A2230] bg-[rgba(6,10,17,0.88)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-9">
                    <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-2xl border border-[#1E2A3D] bg-gradient-to-br from-[#111A2A] to-[#0A0F17]">
                        <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#30425F] bg-[#0F1724] text-[#A8B9D6]">
                            <span className="text-2xl">⬢</span>
                        </div>
                    </div>

                    <h1 className="mb-2 text-center font-serif text-5xl italic text-[#FFF2D9]">
                        {loginMode ? "Welcome Back" : "Create Account"}
                    </h1>
                    <p className="mb-8 text-center text-xs tracking-[0.2em] text-[#9CA7BC] uppercase">
                        {loginMode
                            ? "Secure Communication For The Modern Age"
                            : "Begin Your Secure Communication Journey"}
                    </p>

                    <form className="space-y-5" onSubmit={onSubmit}>
                        {!loginMode && (
                            <label className="block">
                                <span className="mb-2 block text-xs tracking-[0.14em] text-[#AAB6CD] uppercase">
                                    Display Name
                                </span>
                                <input
                                    required
                                    autoComplete="name"
                                    value={name ?? ""}
                                    onChange={(event) => onNameChange?.(event.target.value)}
                                    className="w-full rounded-xl border border-[#232F43] bg-[#0B111A] px-4 py-3.5 text-[#E9EDF8] outline-none transition focus:border-[#4C6EA8]"
                                    placeholder="Your Name"
                                />
                            </label>
                        )}

                        <label className="block">
                            <span className="mb-2 block text-xs tracking-[0.14em] text-[#AAB6CD] uppercase">
                                Email Address
                            </span>
                            <input
                                required
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(event) => onEmailChange(event.target.value)}
                                className="w-full rounded-xl border border-[#232F43] bg-[#0B111A] px-4 py-3.5 text-[#E9EDF8] outline-none transition focus:border-[#4C6EA8]"
                                placeholder="name@monolith.com"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 flex items-center justify-between text-xs tracking-[0.14em] text-[#AAB6CD] uppercase">
                                <span>Security Code</span>
                                {loginMode && (
                                    <button
                                        type="button"
                                        className="text-[11px] font-semibold tracking-[0.14em] text-[#D8E0F2] hover:text-white"
                                    >
                                        Forgot?
                                    </button>
                                )}
                            </span>
                            <input
                                required
                                type="password"
                                autoComplete={loginMode ? "current-password" : "new-password"}
                                minLength={8}
                                value={password}
                                onChange={(event) => onPasswordChange(event.target.value)}
                                className="w-full rounded-xl border border-[#232F43] bg-[#0B111A] px-4 py-3.5 text-[#E9EDF8] outline-none transition focus:border-[#4C6EA8]"
                                placeholder="••••••••"
                            />
                        </label>

                        {errorMessage && (
                            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                {errorMessage}
                            </p>
                        )}

                        <button
                            disabled={isSubmitting}
                            type="submit"
                            className="mt-3 w-full rounded-xl bg-[#D8D9DD] px-4 py-3.5 text-sm font-bold tracking-[0.1em] text-[#0A1D34] uppercase transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSubmitting
                                ? "Please Wait..."
                                : loginMode
                                    ? "Initiate Session"
                                    : "Create Account"}
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-3 text-[11px] tracking-[0.16em] text-[#77839C] uppercase">
                        <div className="h-px flex-1 bg-[#283142]" />
                        <span>Verification Gateways</span>
                        <div className="h-px flex-1 bg-[#283142]" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="rounded-xl border border-[#222E42] bg-[#0B111A] px-4 py-3 text-sm font-semibold tracking-[0.08em] text-[#E4EAF7] uppercase"
                        >
                            Google
                        </button>
                        <button
                            type="button"
                            className="rounded-xl border border-[#222E42] bg-[#0B111A] px-4 py-3 text-sm font-semibold tracking-[0.08em] text-[#E4EAF7] uppercase"
                        >
                            Apple
                        </button>
                    </div>

                    <p className="mt-10 text-center text-sm text-[#9FAAC0]">
                        {loginMode ? "Don’t have an account? " : "Already have an account? "}
                        <Link
                            to={loginMode ? "/signup" : "/login"}
                            className="font-semibold text-[#F8FBFF] hover:text-[#A3C4FF]"
                        >
                            {loginMode ? "Sign Up" : "Sign In"}
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    );
}
