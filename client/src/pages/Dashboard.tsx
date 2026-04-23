import { useState, useEffect, useRef } from "react";
import { getBearerToken, useSession } from "../api/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface ActiveUser {
    id: string | null;
    type: "direct" | "room" | null;

}

interface UserItem {
    id: string;
    name?: string | null;
    email?: string | null;
    lastMessageAt?: string | null;
}

interface RoomItem {
    id: string;
    name: string;
    createdAt: string;
}

interface MessageItem {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    status: "sent" | "delivered" | "read";
    deliveredAt: string | null;
    readAt: string | null;
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
    status?: "sent" | "delivered" | "read";
    deliveredAt?: string | null;
    readAt?: string | null;
};

const mapServerMessage = (msg: ServerMessage): MessageItem => ({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.text,
    createdAt: msg.timestamp,
    status: msg.status ?? "sent",
    deliveredAt: msg.deliveredAt ?? null,
    readAt: msg.readAt ?? null,
});

const normalizeSearchText = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

const getStatusLabel = (msg: MessageItem) => {
    if (msg.status === "read") return "Read";
    if (msg.status === "delivered") return "Delivered";
    return "Sent";
};

type RoomHistoryMessage = {
    id: string;
    senderId: string;
    timestamp: string;
};

const fetchSidebarData = async (
    setData: React.Dispatch<React.SetStateAction<DashboardData>>,
): Promise<DashboardData | null> => {
    const bearerToken = getBearerToken();
    if (!bearerToken) return null;

    const [usersRes, roomsRes] = await Promise.all([
        fetch("http://localhost:3000/api/users", {
            headers: { Authorization: "Bearer " + bearerToken },
        }),
        fetch("http://localhost:3000/api/rooms", {
            headers: { Authorization: "Bearer " + bearerToken },
        }),
    ]);

    if (!usersRes.ok || !roomsRes.ok) {
        throw new Error("Failed to fetch data");
    }

    const users = (await usersRes.json()) as UserItem[];
    const rooms = (await roomsRes.json()) as RoomItem[];
    const next = { users, rooms };
    setData(next);
    return next;
};

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
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentUserId = session?.user.id;
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const sortedFilteredUsers = data.users.filter(u => {
        const nameMatch = u.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const emailMatch = u.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const lastMessageMatch = u.lastMessageAt?.toLowerCase().includes(searchQuery.toLowerCase());
        return nameMatch || emailMatch || lastMessageMatch;
    }).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
    });
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [createRoomError, setCreateRoomError] = useState<string | null>(null);

    const [unreadDirect, setUnreadDirect] = useState<Record<string, number>>({});
    const [unreadRooms, setUnreadRooms] = useState<Record<string, number>>({});
    const [lastSeenRooms, setLastSeenRooms] = useState<Record<string, string>>({});
    const [sidebarMode, setSidebarMode] = useState<"direct" | "room" | null>(null);



    const handleSearchID = async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        setIsSearching(true);
        try {
            const bearerToken = getBearerToken();
            const rawQuery = searchQuery.trim();

            if (!rawQuery) {
                return;
            }

            const query = normalizeSearchText(rawQuery);
            const findInUsers = (users: UserItem[]) =>
                users.find((u) => {
                    const name = normalizeSearchText(u.name ?? "");
                    const email = normalizeSearchText(u.email ?? "");
                    const id = normalizeSearchText(u.id);

                    return name.includes(query) || email.includes(query) || id === query;
                });

            const localMatch = findInUsers(data.users);

            if (localMatch) {
                setActiveChat({ id: localMatch.id, type: "direct" });
                setSearchQuery("");
                return;
            }

            if (bearerToken) {
                const usersRes = await fetch("http://localhost:3000/api/users", {
                    headers: { Authorization: `Bearer ${bearerToken}` },
                });

                if (usersRes.ok) {
                    const users = (await usersRes.json()) as UserItem[];
                    setData((prev) => ({ ...prev, users }));

                    const refreshedMatch = findInUsers(users);
                    if (refreshedMatch) {
                        setActiveChat({ id: refreshedMatch.id, type: "direct" });
                        setSearchQuery("");
                        return;
                    }
                }
            }

            const res = await fetch(`http://localhost:3000/api/users/${rawQuery}`, {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                },
            });
            if (res.ok) {
                const foundUser = await res.json();
                setActiveChat({ id: foundUser.id, type: "direct" });
                setData(prev => ({
                    ...prev,
                    users: prev.users.some(u => u.id === foundUser.id) ? prev.users : [...prev.users, foundUser]
                }));
                setSearchQuery("");
            } else {
                alert("User not found.");
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (isPending || !session) return;

        const run = async () => {
            try {
                setIsLoading(true);
                const sidebar = await fetchSidebarData(setData);
                if (sidebar) {
                    await refreshUnreadCounts(sidebar.users, sidebar.rooms);
                }
            } catch {
                setError("Failed to load data");
            } finally {
                setIsLoading(false);
            }
        };

        run();
    }, [isPending, session]);

    useEffect(() => {
        if (!session) return;

        const id = setInterval(async () => {
            try {
                const sidebar = await fetchSidebarData(setData);
                if (sidebar) {
                    await refreshUnreadCounts(sidebar.users, sidebar.rooms);
                }
            } catch {
                // keep silent during polling
            }
        }, 10000);

        return () => clearInterval(id);
    }, [session, activeChat.id, activeChat.type, lastSeenRooms]);


    type SendMessageResponse =
        | ServerMessage
        | {
            userMessage: ServerMessage;
            aiMessage?: ServerMessage;
        };
    const hasAiPayload = (
        payload: SendMessageResponse,
    ): payload is { userMessage: ServerMessage; aiMessage?: ServerMessage } => {
        return (
            typeof payload === "object" &&
            payload !== null &&
            "userMessage" in payload
        );
    };

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

            const payload = (await response.json()) as SendMessageResponse;

            if (hasAiPayload(payload)) {
                setMessages((prev) => {
                    const next = [...prev, mapServerMessage(payload.userMessage)];
                    if (payload.aiMessage) next.push(mapServerMessage(payload.aiMessage));
                    return next;
                });
            } else {
                setMessages((prev) => [...prev, mapServerMessage(payload)]);
            }
            const sidebar = await fetchSidebarData(setData);
            if (sidebar) {
                await refreshUnreadCounts(sidebar.users, sidebar.rooms);
            }

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

                if (activeChat.type === "direct") {
                    await fetch("http://localhost:3000/api/messages/mark-read", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${bearerToken}`,
                        },
                        body: JSON.stringify({ otherUserId: activeChat.id }),
                    });

                    const refreshed = await fetch(endpoint, {
                        headers: {
                            Authorization: `Bearer ${bearerToken}`,
                        },
                    });

                    if (refreshed.ok) {
                        const refreshedHistory = (await refreshed.json()) as ServerMessage[];
                        setMessages(refreshedHistory.map(mapServerMessage));
                    }

                    setUnreadDirect((prev) => ({ ...prev, [activeChat.id as string]: 0 }));
                } else {
                    const roomHistory = chatHistory as RoomHistoryMessage[];
                    const latest = roomHistory.length > 0 ? roomHistory[roomHistory.length - 1].timestamp : null;
                    if (latest) {
                        setLastSeenRooms((prev) => ({ ...prev, [activeChat.id as string]: latest }));
                    }
                    setUnreadRooms((prev) => ({ ...prev, [activeChat.id as string]: 0 }));
                }
            } catch {
                setMessages([]);
            }
        };

        fetchMessages();
    }, [activeChat.id, activeChat.type]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        if (activeChat.type !== "room" || !activeChat.id || messages.length === 0) {
            return;
        }

        const latestVisible = messages[messages.length - 1]?.createdAt;
        if (!latestVisible) {
            return;
        }

        setLastSeenRooms((prev) => {
            if (prev[activeChat.id as string] === latestVisible) {
                return prev;
            }
            return { ...prev, [activeChat.id as string]: latestVisible };
        });
    }, [activeChat.id, activeChat.type, messages]);
    const refreshUnreadCounts = async (
        usersList: UserItem[] = data.users,
        roomsList: RoomItem[] = data.rooms,
    ) => {
        const bearerToken = getBearerToken();
        if (!bearerToken || !currentUserId) return;


        const directCounts = await Promise.all(
            usersList.map(async (u) => {
                try {
                    const res = await fetch(`http://localhost:3000/api/messages/${u.id}`, {
                        headers: { Authorization: `Bearer ${bearerToken}` },
                    });
                    if (!res.ok) return [u.id, 0] as const;


                    const history = (await res.json()) as ServerMessage[];
                    const count = history.filter(
                        (m) => m.senderId !== currentUserId && m.status !== "read",
                    ).length;
                    return [u.id, activeChat.type === "direct" && activeChat.id === u.id ? 0 : count] as const;
                } catch {
                    return [u.id, 0] as const;
                }
            }),
        );

        const seenRoomUpdates: Record<string, string> = {};

        const roomCounts = await Promise.all(
            roomsList.map(async (r) => {
                try {
                    const res = await fetch(`http://localhost:3000/api/rooms/${r.id}/messages`, {
                        headers: { Authorization: `Bearer ${bearerToken}` },
                    });
                    if (!res.ok) return [r.id, 0] as const;

                    const history = (await res.json()) as RoomHistoryMessage[];
                    const latest = history.length > 0 ? history[history.length - 1]?.timestamp : undefined;

                    if (activeChat.type === "room" && activeChat.id === r.id && latest) {
                        seenRoomUpdates[r.id] = latest;
                    }

                    const seenAt =
                        activeChat.type === "room" && activeChat.id === r.id
                            ? latest ?? lastSeenRooms[r.id]
                            : lastSeenRooms[r.id];

                    const count = history.filter((m) => {
                        if (m.senderId === currentUserId) return false;
                        if (!seenAt) return true;
                        return new Date(m.timestamp).getTime() > new Date(seenAt).getTime();
                    }).length;

                    return [r.id, activeChat.type === "room" && activeChat.id === r.id ? 0 : count] as const;
                } catch {
                    return [r.id, 0] as const;
                }
            }),
        );

        if (Object.keys(seenRoomUpdates).length > 0) {
            setLastSeenRooms((prev) => ({ ...prev, ...seenRoomUpdates }));
        }

        setUnreadDirect(Object.fromEntries(directCounts));
        setUnreadRooms(Object.fromEntries(roomCounts));
    };

    const handleCreateRoom = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const name = newRoomName.trim();
        if (!name) {
            setCreateRoomError("Room name is required.");
            return;
        }

        const bearerToken = getBearerToken();
        if (!bearerToken) {
            setCreateRoomError("Missing bearer token. Please sign in again.");
            return;
        }

        try {
            setIsCreatingRoom(true);
            setCreateRoomError(null);

            const response = await fetch("http://localhost:3000/api/rooms/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${bearerToken}`,
                },
                body: JSON.stringify({ name }),
            });

            if (!response.ok) {
                throw new Error("Failed to create room");
            }

            const sidebar = await fetchSidebarData(setData);
            if (sidebar) {
                await refreshUnreadCounts(sidebar.users, sidebar.rooms);
            }

            setNewRoomName("");
            setShowCreateRoomModal(false);
        } catch {
            setCreateRoomError("Unable to create room right now.");
        } finally {
            setIsCreatingRoom(false);
        }
    };

    return (
        <div className="relative h-screen overflow-hidden bg-[#03030A] text-[#D3D9EB]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_70%_10%,rgba(86,48,163,0.22)_0%,rgba(5,4,20,0.95)_55%,rgba(3,3,10,1)_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(118,98,170,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(118,98,170,0.06)_1px,transparent_1px)] bg-size-[220px_220px]" />

            <div className="relative flex h-full w-full">
                {/* Icon Rail */}
                <aside className="flex w-24 shrink-0 flex-col items-center border-r border-[#24203B] bg-[rgba(2,2,10,0.9)] px-3 py-6">
                    <button type="button" className="mb-8 inline-flex h-10 w-10 items-center justify-center border border-[#3A3458] bg-[#0C0A1C] text-[#C3BDE0]">
                        ☁
                    </button>

                    <button
                        type="button"
                        onClick={() => setSidebarMode(sidebarMode === "direct" ? null : "direct")}
                        className={`mb-4 flex w-full flex-col items-center gap-1 border px-2 py-2 text-[9px] tracking-[0.2em] uppercase transition ${sidebarMode === "direct"
                            ? "border-[#6C619A] bg-[#15122A] text-[#E6E3F5]"
                            : "border-transparent text-[#7F78A3] hover:border-[#3A335A] hover:bg-[#0F0C21]"
                            }`}
                    >
                        <span className="text-sm">◉</span>
                        Direct
                    </button>

                    <button
                        type="button"
                        onClick={() => setSidebarMode(sidebarMode === "room" ? null : "room")}
                        className={`mb-4 flex w-full flex-col items-center gap-1 border px-2 py-2 text-[9px] tracking-[0.2em] uppercase transition ${sidebarMode === "room"
                            ? "border-[#6C619A] bg-[#15122A] text-[#E6E3F5]"
                            : "border-transparent text-[#7F78A3] hover:border-[#3A335A] hover:bg-[#0F0C21]"
                            }`}
                    >
                        <span className="text-sm">◎</span>
                        Rooms
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveChat({ id: null, type: null });
                            setSidebarMode(null);
                        }}
                        className="mb-8 flex w-full flex-col items-center gap-1 border border-transparent px-2 py-2 text-[9px] tracking-[0.2em] uppercase text-[#7F78A3] transition hover:border-[#3A335A] hover:bg-[#0F0C21]"
                    >
                        <span className="text-sm">◌</span>
                        Home
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setCreateRoomError(null);
                            setShowCreateRoomModal(true);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center border border-[#4B426F] bg-[#0E0B21] text-xl text-[#ECE8FB] transition hover:bg-[#181436]"
                        title="Create room"
                    >
                        +
                    </button>

                    <div className="mt-auto w-full border-t border-[#2B2545] pt-4 text-center">
                        <p className="text-[8px] tracking-[0.24em] text-[#9087B3] uppercase">Connected</p>
                        <p className="mt-1 text-[8px] tracking-[0.2em] text-[#635C84]">v1.0.42</p>
                    </div>
                </aside>

                {/* Sliding Contacts Drawer */}
                <div
                    className={`border-r border-[#24203B] bg-[rgba(8,6,20,0.85)] transition-all duration-300 overflow-hidden ${sidebarMode ? "w-56" : "w-0"
                        }`}
                >
                    <div className="flex h-full flex-col p-4">
                        <h3 className="mb-4 text-[11px] font-semibold tracking-[0.2em] text-[#D9D2F1] uppercase">
                            {sidebarMode === "direct" ? "Direct Contacts" : "Rooms"}
                        </h3>

                        <div className="flex-1 space-y-1.5 overflow-y-auto">
                            {sidebarMode === "direct"
                                ? sortedFilteredUsers.map((u) => (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveChat({ id: u.id, type: "direct" });
                                            setSidebarMode(null);
                                        }}
                                        className={`flex w-full items-center justify-between rounded border px-2.5 py-2 text-left text-xs transition ${activeChat.id === u.id && activeChat.type === "direct"
                                            ? "border-[#6C619A] bg-[#1F1A3D] text-[#F0ECFF]"
                                            : "border-[#2B2450] bg-[#0F0C21] text-[#B8B0DA] hover:border-[#4A4273] hover:bg-[#15112B]"
                                            }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium">{u.name || u.email || "Unknown"}</p>
                                            <p className="text-[9px] tracking-[0.08em] text-[#8178A0]">USER</p>
                                        </div>
                                        {(unreadDirect[u.id] ?? 0) > 0 && (
                                            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D95A6F] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                                {unreadDirect[u.id] > 99 ? "99+" : unreadDirect[u.id]}
                                            </span>
                                        )}
                                    </button>
                                ))
                                : data.rooms.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveChat({ id: r.id, type: "room" });
                                            setSidebarMode(null);
                                        }}
                                        className={`flex w-full items-center justify-between rounded border px-2.5 py-2 text-left text-xs transition ${activeChat.id === r.id && activeChat.type === "room"
                                            ? "border-[#6C619A] bg-[#1F1A3D] text-[#F0ECFF]"
                                            : "border-[#2B2450] bg-[#0F0C21] text-[#B8B0DA] hover:border-[#4A4273] hover:bg-[#15112B]"
                                            }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium"># {r.name}</p>
                                            <p className="text-[9px] tracking-[0.08em] text-[#8178A0]">ROOM</p>
                                        </div>
                                        {(unreadRooms[r.id] ?? 0) > 0 && (
                                            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D95A6F] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                                {unreadRooms[r.id] > 99 ? "99+" : unreadRooms[r.id]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                        </div>

                        {!session && !isPending && (
                            <p className="mt-3 border border-amber-900/40 bg-amber-950/30 px-2 py-2 text-[9px] text-amber-300">Sign in to load contacts.</p>
                        )}
                        {isLoading && <p className="mt-3 text-[9px] text-[#8D83B2]">Loading...</p>}
                        {error && <p className="mt-3 border border-rose-900/50 bg-rose-950/30 px-2 py-2 text-[9px] text-rose-300">Error: {error}</p>}
                    </div>
                </div>

                <main className="relative flex-1 overflow-hidden border-l border-[#1D1734] bg-[linear-gradient(145deg,rgba(35,16,66,0.7)_0%,rgba(9,7,30,0.96)_45%,rgba(6,5,20,1)_100%)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_100%_at_20%_10%,rgba(163,140,223,0.18)_0%,rgba(24,18,48,0)_52%)]" />

                    {activeChat.id ? (
                        <div className="relative flex h-full flex-col">
                            <div className="flex items-start justify-between border-b border-[#272043] px-8 py-6">
                                <div>
                                    <p className="text-[10px] tracking-[0.28em] text-[#8D83B2] uppercase">Active Thread</p>
                                    <h2 className="mt-2 text-4xl font-semibold tracking-[0.04em] text-[#F1EDFF]">{activeChat.id}</h2>
                                    <p className="mt-1 text-[11px] tracking-[0.2em] text-[#A79FC8] uppercase">{activeChat.type}</p>
                                </div>
                                <div className="text-right text-[10px] tracking-[0.2em] text-[#7C739F] uppercase">REF.00.CHAT</div>
                            </div>

                            <div className="flex flex-1 flex-col overflow-hidden">
                                <div className="flex-1 space-y-4 overflow-y-auto px-8 py-6">
                                    {messages.length > 0 ? (
                                        messages.map((msg: MessageItem) => {
                                            const isMe = msg.senderId === currentUserId;
                                            return (
                                                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[70%] border px-4 py-3 ${isMe
                                                        ? "border-[#6F62A3] bg-[#2A2248] text-[#F0ECFF]"
                                                        : "border-[#3A335D] bg-[#14102B] text-[#CDC6EA]"
                                                        }`}>
                                                        {msg.senderId === "gemini-bot" ? (
                                                            <div className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    rehypePlugins={[rehypeSanitize]}
                                                                    components={{
                                                                        h1: ({ children }) => <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>,
                                                                        h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>,
                                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                                        ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                                                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                                                        li: ({ children }) => <li className="mb-1">{children}</li>,
                                                                        code: ({ children }) => (
                                                                            <code className="rounded bg-black/30 px-1 py-0.5 text-xs">{children}</code>
                                                                        ),
                                                                        pre: ({ children }) => (
                                                                            <pre className="my-2 overflow-x-auto rounded bg-black/35 p-3 text-xs">{children}</pre>
                                                                        ),
                                                                        a: ({ href, children }) => (
                                                                            <a
                                                                                href={href}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="underline text-[#9fd2ff]"
                                                                            >
                                                                                {children}
                                                                            </a>
                                                                        ),
                                                                    }}
                                                                >
                                                                    {msg.content}
                                                                </ReactMarkdown>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                                                        )}
                                                        <div className="mt-2 flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                                                            <span className={isMe ? "text-[#BBB1DF]" : "text-[#8D83B2]"}>
                                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                            {isMe && <span className="text-[#CFC6EF]">{getStatusLabel(msg)}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="mx-auto mt-16 max-w-3xl border border-[#3A335D] bg-[#15112B]/80 p-8">
                                            <p className="text-3xl font-semibold tracking-[0.02em] text-[#F0ECFF]">NO ACTIVE THREAD</p>
                                            <p className="mt-4 text-[11px] tracking-[0.16em] text-[#9C93BE] uppercase">
                                                Your workspace is quiet. Dive back into your recent conversations.
                                            </p>
                                        </div>
                                    )}
                                    <div ref={scrollRef} />
                                </div>

                                <div className="border-t border-[#2B2448] bg-[#0E0A21] px-8 py-5">
                                    <form className="flex gap-2" onSubmit={handleSendMessage}>
                                        <input
                                            name="msg"
                                            value={messageDraft}
                                            onChange={(event) => setMessageDraft(event.target.value)}
                                            className="flex-1 border border-[#3E3563] bg-[#120E29] px-4 py-3 text-sm text-[#E9E4FA] outline-none placeholder:text-[#8178A5] focus:border-[#6E62A3]"
                                            placeholder="Transmit message..."
                                        />
                                        <button
                                            disabled={isSending}
                                            className="border border-[#554A80] bg-[#251E42] px-6 py-3 text-xs font-semibold tracking-[0.18em] text-[#F4F0FF] uppercase transition hover:bg-[#32275A] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isSending ? "Sending" : "Send"}
                                        </button>
                                    </form>
                                    {sendError && <p className="mt-2 text-xs text-rose-300">{sendError}</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative flex h-full flex-col px-6 py-4 sm:px-8 sm:py-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-5xl font-bold leading-none tracking-[0.02em] text-[#F6F2FF]">CHATRIX</h1>
                                    <p className="mt-1 text-[10px] tracking-[0.3em] text-[#958BB8] uppercase">STUDIO v1.0</p>
                                </div>
                                <form onSubmit={handleSearchID}>
                                    <button
                                        type="submit"
                                        disabled={!searchQuery || isSearching}
                                        className="inline-flex h-8 w-8 items-center justify-center border border-[#463D6A] bg-[#1A1434] text-[#D4CCEE] transition hover:bg-[#241C46] disabled:cursor-not-allowed disabled:opacity-50"
                                        title="Search user by ID or name"
                                    >
                                        ⌕
                                    </button>
                                </form>
                            </div>

                            <form className="mt-6 max-w-md" onSubmit={handleSearchID}>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Paste user ID or name"
                                    className="w-full border border-[#403760] bg-[#120E2A] px-3 py-2 text-[11px] tracking-[0.08em] text-[#D6D0EF] outline-none placeholder:text-[#7D73A0] focus:border-[#6C619A]"
                                />
                            </form>

                            <div className="mt-8 max-w-4xl">
                                <p className="text-[11px] tracking-[0.28em] text-[#9E96C1] uppercase">Select a conversation to start messaging</p>
                                <h2 className="mt-2 text-[clamp(54px,9vw,112px)] font-black leading-none tracking-[0.01em] text-[#FFFFFF1A]">CHATS</h2>
                            </div>

                            <div className="mt-10 flex items-center gap-3 text-[11px] tracking-[0.24em] text-[#7E75A5] uppercase">
                                <span className="inline-flex h-9 w-9 items-center justify-center border border-[#3D345E] bg-[#120E28]">◧</span>
                                REF.00.CHAT
                            </div>

                            <div className="mt-8 max-w-4xl border border-[#3A325B] bg-[#1A1434]/75 px-6 py-6">
                                <p className="text-3xl font-semibold tracking-[0.01em] text-[#F3EEFF]">NO ACTIVE THREAD</p>
                                <p className="mt-3 text-[11px] tracking-[0.15em] text-[#A298C3] uppercase">
                                    Your workspace is quiet. Dive back into your recent conversations or start a new connection.
                                </p>
                            </div>

                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSidebarMode("direct");
                                    }}
                                    className="border border-[#E7E3F5] bg-[#F4F1FA] px-10 py-4 text-xs font-bold tracking-[0.28em] text-[#090814] uppercase transition hover:bg-white"
                                >
                                    Start A Discussion
                                </button>
                                <span className="text-[10px] tracking-[0.22em] text-[#766C9B] uppercase">ACTION.EXE</span>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {showCreateRoomModal && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
                    <div className="w-full max-w-md border border-[#2C3D5D] bg-[#0A111D] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
                        <h3 className="text-lg font-semibold tracking-[0.08em] text-[#D7E2F8]">Create New Room</h3>
                        <p className="mt-1 text-xs tracking-[0.14em] text-[#7288AF] uppercase">Give your room a clear, short name.</p>

                        <form className="mt-4 space-y-3" onSubmit={handleCreateRoom}>
                            <input
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="e.g. design-ops"
                                className="w-full border border-[#253653] bg-[#0D1523] px-3 py-2 text-sm text-[#CFDCF6] outline-none placeholder:text-[#60769D] focus:border-[#4A638F]"
                            />

                            {createRoomError && (
                                <p className="text-sm text-rose-400">{createRoomError}</p>
                            )}

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateRoomModal(false)}
                                    className="border border-[#2F4160] px-3 py-2 text-sm text-[#A9BCDE] hover:bg-[#132035]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingRoom}
                                    className="border border-[#3F557C] bg-[#1F3354] px-3 py-2 text-sm font-bold text-[#D7E3FA] hover:bg-[#2A4471] disabled:opacity-70"
                                >
                                    {isCreatingRoom ? "Creating..." : "Create Room"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );

};



export default DashboardPage;

