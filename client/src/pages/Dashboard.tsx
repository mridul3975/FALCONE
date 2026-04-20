import { useState, useEffect } from "react";
import { getBearerToken, useSession } from "../api/auth";

interface ActiveUser {
    id: string | null;
    type: "direct" | "room" | null;

}

interface UserItem {
    id: string;
    name?: string | null;
    email?: string | null;
}

interface RoomItem {
    id: string;
    name: string;
}

interface MessageItem {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
}

interface DashboardData {
    users: UserItem[];
    rooms: RoomItem[];
}

type ServerMessage = {
    id: string;
    senderId: string;
    text: string;
    timestamp: string;
};

const mapServerMessage = (msg: ServerMessage) => ({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.text,
    createdAt: msg.timestamp,
});

const DashboardPage = () => {
    //State Management
    const { data: session, isPending } = useSession();
    const [activeChat, setActiveChat] = useState<ActiveUser>({ id: null, type: null });
    const [data, setData] = useState<DashboardData>({ users: [], rooms: [] });
    const [messageDraft, setMessageDraft] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);

    useEffect(() => {
        if (isPending || !session) {
            return;
        }

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const bearerToken = getBearerToken();

                if (!bearerToken) {
                    throw new Error("Missing bearer token");
                }

                const [usersRes, roomsRes] = await Promise.all([
                    fetch("http://localhost:3000/api/users", {
                        headers: {
                            Authorization: `Bearer ${bearerToken}`,
                        },
                    }),
                    fetch("http://localhost:3000/api/rooms", {
                        headers: {
                            Authorization: `Bearer ${bearerToken}`,
                        },
                    }),
                ]);
                if (!usersRes.ok || !roomsRes.ok) {
                    throw new Error("Failed to fetch data");
                }
                const users = (await usersRes.json()) as UserItem[];
                const rooms = (await roomsRes.json()) as RoomItem[];
                setData({ users, rooms });
                setIsLoading(false);
            }
            catch (err) {
                setError("Failed to load data");
                setIsLoading(false);
            }
        };

        fetchData();
    }, [isPending, session]);

    const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!activeChat.id || !activeChat.type) {
            setSendError("Select a user or room before sending.");
            return;
        }

        const trimmedMessage = messageDraft.trim();
        if (!trimmedMessage) {
            setSendError("Enter a message first.");
            return;
        }

        const bearerToken = getBearerToken();
        if (!bearerToken) {
            setSendError("Missing bearer token. Please sign in again.");
            return;
        }

        try {
            setIsSending(true);
            setSendError(null);

            const response = await fetch("http://localhost:3000/api/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${bearerToken}`,
                },
                body: JSON.stringify({
                    targetId: activeChat.id,
                    content: trimmedMessage,
                    type: activeChat.type,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to send message");
            }

            const savedMessage = await response.json();
            setMessages((prev) => [...prev, mapServerMessage(savedMessage)]);

        } catch {
            setSendError("Unable to send message right now.");
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        if (!activeChat.id || !activeChat.type) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            try {
                const bearerToken = getBearerToken();

                if (!bearerToken) {
                    setMessages([]);
                    return;
                }
                const endpoint =
                    activeChat.type === "direct"
                        ? `http://localhost:3000/api/messages/${activeChat.id}`
                        : `http://localhost:3000/api/rooms/${activeChat.id}/messages`;

                const response = await fetch(endpoint,
                    {
                        headers: {
                            Authorization: `Bearer ${bearerToken}`,
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch messages");
                }

                const chatHistory = (await response.json()) as ServerMessage[];
                setMessages(chatHistory.map(mapServerMessage));
            } catch {
                setMessages([]);
            }
        };

        fetchMessages();
    }, [activeChat.id, activeChat.type]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fbff_0%,#eef3f9_45%,#e7edf5_100%)] text-slate-900">
            <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl gap-5 p-4 sm:p-6">
                <aside className="flex w-72 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="border-b border-slate-200 px-5 py-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Live Context</p>
                        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Connections</h1>
                        <p className="mt-1 text-sm text-slate-500">Choose a user or room to inspect the active target.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-5">
                        {!session && !isPending && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Sign in to load users and rooms.</p>}
                        {isLoading && <p className="text-sm text-slate-500">Loading connections...</p>}
                        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Error: {error}</p>}

                        {/* Direct Section */}
                        <div className="mb-6 mt-5">
                            <h3 className="mb-3 text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">Direct</h3>
                            <div className="space-y-2">
                                {data.users.map(u => (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => setActiveChat({ id: u.id, type: "direct" })}
                                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-400 ${activeChat.id === u.id && activeChat.type === "direct" ? "border-sky-200 bg-sky-50 text-sky-950 shadow-sm" : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50"}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-slate-900">{u.name || u.email || "Unknown user"}</span>
                                            <span className="block text-xs text-slate-500">Direct thread</span>
                                        </span>
                                        <span className="ml-3 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">User</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rooms Section */}
                        <div>
                            <h3 className="mb-3 text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">Rooms</h3>
                            <div className="space-y-2">
                                {data.rooms.map(r => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setActiveChat({ id: r.id, type: "room" })}
                                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${activeChat.id === r.id && activeChat.type === "room" ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50"}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-slate-900"># {r.name}</span>
                                            <span className="block text-xs text-slate-500">Room channel</span>
                                        </span>
                                        <span className="ml-3 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">Room</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex h-full flex-col">
                        {activeChat.id ? (
                            <>
                                <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
                                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
                                        Active selection
                                    </div>
                                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Target: {activeChat.id}</h2>
                                    <p className="mt-2 text-base text-slate-600">Type: {activeChat.type}</p>
                                </div>

                                <div className="flex flex-1 flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                        {messages.length > 0 ? (
                                            messages.map((msg) => (
                                                <div key={msg.id} className={`flex ${msg.senderId === session?.user?.id ? "justify-end" : "justify-start"}`}>
                                                    <div
                                                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.senderId === session?.user?.id
                                                            ? "bg-sky-600 text-white"
                                                            : "bg-slate-100 text-slate-900"
                                                            }`}
                                                    >
                                                        <p className="text-sm">{msg.content}</p>
                                                        <span className="text-[10px] opacity-70">
                                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="mt-10 text-center text-slate-400">No messages yet. Say hi!</p>
                                        )}
                                    </div>

                                    <div className="border-t border-slate-200 px-6 py-5 sm:px-8">
                                        <form className="flex gap-2" onSubmit={handleSendMessage}>
                                            <input
                                                name="msg"
                                                value={messageDraft}
                                                onChange={(event) => setMessageDraft(event.target.value)}
                                                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-sky-400 focus:outline-none"
                                                placeholder="Type a test message..."
                                            />
                                            <button
                                                disabled={isSending}
                                                className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {isSending ? "Sending..." : "Send"}
                                            </button>
                                        </form>
                                        {sendError && <p className="mt-2 text-left text-sm text-rose-600">{sendError}</p>}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
                                <div className="max-w-lg text-center">
                                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Pick a conversation</h2>
                                    <p className="mt-3 text-base text-slate-600">Choose a direct user or room from the left to load its state here.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );

};

export default DashboardPage;
