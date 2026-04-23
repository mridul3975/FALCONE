import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBearerToken } from "../api/auth";

type UserProfile = {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    age?: number | null;
};

const getAvatarToken = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "?";

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 1).toUpperCase();
    }

    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
};

export default function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            if (!userId) {
                setError("Invalid user profile URL.");
                setLoading(false);
                return;
            }

            const token = getBearerToken();
            if (!token) {
                setError("Missing bearer token. Please sign in again.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    setError("Unable to load profile.");
                    setProfile(null);
                    return;
                }

                const data = (await response.json()) as UserProfile;
                setProfile(data);
            } catch {
                setError("Unable to load profile right now.");
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, [userId]);

    const profileName = useMemo(() => profile?.name?.trim() || "Unknown User", [profile]);
    const avatarToken = useMemo(() => getAvatarToken(profileName), [profileName]);

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#03030A] text-[#D3D9EB]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_70%_10%,rgba(86,48,163,0.22)_0%,rgba(5,4,20,0.95)_55%,rgba(3,3,10,1)_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(118,98,170,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(118,98,170,0.06)_1px,transparent_1px)] bg-size-[220px_220px]" />

            <section className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8 sm:px-8">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-semibold tracking-[0.04em] text-[#F1EDFF]">Profile</h1>
                    <Link
                        to="/dashboard"
                        className="border border-[#554A80] bg-[#251E42] px-4 py-2 text-xs font-semibold tracking-[0.16em] text-[#F4F0FF] uppercase transition hover:bg-[#32275A]"
                    >
                        Back To Chat
                    </Link>
                </div>

                <div className="border border-[#2B2448] bg-[rgba(14,10,33,0.92)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-8">
                    {loading ? (
                        <p className="text-sm text-[#A79FC8]">Loading profile...</p>
                    ) : error ? (
                        <p className="border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
                    ) : profile ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                {profile.image ? (
                                    <img
                                        src={profile.image}
                                        alt={`${profileName} avatar`}
                                        className="h-16 w-16 rounded-full border border-[#6F62A3] object-cover"
                                    />
                                ) : (
                                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#6F62A3] bg-[#1C1736] text-xl font-semibold text-[#EDE7FF]">
                                        {avatarToken}
                                    </div>
                                )}

                                <div>
                                    <h2 className="text-2xl font-semibold text-[#F1EDFF]">{profileName}</h2>
                                    <p className="text-sm text-[#A79FC8]">{profile.email || "No email available"}</p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="border border-[#3A335D] bg-[#14102B] p-4">
                                    <p className="text-[10px] tracking-[0.2em] text-[#8D83B2] uppercase">User ID</p>
                                    <p className="mt-2 break-all text-sm text-[#E9E4FA]">{profile.id}</p>
                                </div>

                                <div className="border border-[#3A335D] bg-[#14102B] p-4">
                                    <p className="text-[10px] tracking-[0.2em] text-[#8D83B2] uppercase">Age</p>
                                    <p className="mt-2 text-sm text-[#E9E4FA]">{profile.age ?? "Not provided"}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>
        </main>
    );
}
