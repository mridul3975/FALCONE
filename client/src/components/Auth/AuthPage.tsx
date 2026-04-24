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
        <main className="relative min-h-screen overflow-hidden bg-[#03030A] text-[#D3D9EB]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_70%_10%,rgba(86,48,163,0.22)_0%,rgba(5,4,20,0.95)_55%,rgba(3,3,10,1)_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(118,98,170,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(118,98,170,0.06)_1px,transparent_1px)] bg-size-[220px_220px]" />

            <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8 sm:px-8">
                <header className="mb-8 flex items-center justify-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center border border-[#3A3458] bg-[#0C0A1C] text-[13px] font-semibold text-[#C3BDE0]">
                        ☁
                    </span>
                    <span className="text-[32px] font-black tracking-[0.12em] text-[#F6F2FF]">
                        CHATRIX
                    </span>
                </header>

                <div className="border border-[#2B2448] bg-[rgba(14,10,33,0.92)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-9">
                    <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center border border-[#3A335D] bg-[#14102B]">
                        <div className="grid h-12 w-12 place-items-center border border-[#6F62A3] bg-[#2A2248] text-[#F0ECFF]">
                            <span className="text-xl">◉</span>
                        </div>
                    </div>

                    <h1 className="mb-2 text-center text-5xl font-semibold tracking-[0.02em] text-[#F1EDFF]">
                        {loginMode ? "Welcome Back" : "Create Account"}
                    </h1>
                    <p className="mb-8 text-center text-xs tracking-[0.2em] text-[#A79FC8] uppercase">
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
                                    onChange={(event) => onNameChange?.((event.target as unknown as { value: string }).value)}
                                    className="w-full border border-[#3E3563] bg-[#120E29] px-4 py-3.5 text-[#E9E4FA] outline-none transition focus:border-[#6E62A3]"
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
                                onChange={(event) => onEmailChange((event.target as unknown as { value: string }).value)}
                                className="w-full border border-[#3E3563] bg-[#120E29] px-4 py-3.5 text-[#E9E4FA] outline-none transition focus:border-[#6E62A3]"
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
                                onChange={(event) => onPasswordChange((event.target as unknown as { value: string }).value)}
                                className="w-full border border-[#3E3563] bg-[#120E29] px-4 py-3.5 text-[#E9E4FA] outline-none transition focus:border-[#6E62A3]"
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
                            className="mt-3 w-full border border-[#554A80] bg-[#251E42] px-4 py-3.5 text-sm font-bold tracking-widest text-[#F4F0FF] uppercase transition hover:bg-[#32275A] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSubmitting
                                ? "Please Wait..."
                                : loginMode
                                    ? "Initiate Session"
                                    : "Create Account"}
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-3 text-[11px] tracking-[0.16em] text-[#7C739F] uppercase">
                        <div className="h-px flex-1 bg-[#2B2448]" />
                        <span>Verification Gateways</span>
                        <div className="h-px flex-1 bg-[#2B2448]" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="border border-[#3E3563] bg-[#120E29] px-4 py-3 text-sm font-semibold tracking-[0.08em] text-[#E4EAF7] uppercase"
                        >
                            Google
                        </button>
                        <button
                            type="button"
                            className="border border-[#3E3563] bg-[#120E29] px-4 py-3 text-sm font-semibold tracking-[0.08em] text-[#E4EAF7] uppercase"
                        >
                            Apple
                        </button>
                    </div>

                    <p className="mt-10 text-center text-sm text-[#9FAAC0]">
                        {loginMode ? "Don’t have an account? " : "Already have an account? "}
                        <Link
                            to={loginMode ? "/signup" : "/login"}
                            className="font-semibold text-[#F8FBFF] hover:text-[#C3BDE0]"
                        >
                            {loginMode ? "Sign Up" : "Sign In"}
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    );
}
