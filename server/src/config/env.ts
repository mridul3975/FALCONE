type ParsedEnv = {
    PORT: number;
    HOST: string;
    AUTH_BASE_URL: string;
    TRUSTED_ORIGINS: string[];
    GEMINI_API_KEY: string;
    AI_MODEL: string;
    AI_DAILY_LIMIT: number;
    AI_ENABLED: boolean;
};

function getString(name: string, fallback?: string): string {
    const raw = process.env[name]?.trim();
    if (raw) return raw;
    if (fallback !== undefined) return fallback;
    throw new Error("[env] Missing required environment variable: " + name);
}

function getNumber(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error("[env] " + name + " must be a positive number");
    }
    return n;
}
function getBoolean(name: string, fallback = false): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    if (!raw) return fallback;
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getCsv(name: string): string[] {
    return (process.env[name] ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
}

const AI_ENABLED = getBoolean("AI_ENABLED", false);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() ?? "";

if (AI_ENABLED && !GEMINI_API_KEY) {
    throw new Error("[env] GEMINI_API_KEY is required when AI_ENABLED=true");
}

export const env: ParsedEnv = {
    PORT: getNumber("PORT", 3000),
    HOST: getString("HOST", "0.0.0.0"),
    AUTH_BASE_URL: getString("AUTH_BASE_URL", "http://localhost:3000"),
    TRUSTED_ORIGINS: getCsv("TRUSTED_ORIGINS"),
    GEMINI_API_KEY,
    AI_MODEL: getString("AI_MODEL", "gemini-2.5-flash"),
    AI_DAILY_LIMIT: getNumber("AI_DAILY_LIMIT", 30),
    AI_ENABLED,
};