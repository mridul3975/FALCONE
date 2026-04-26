import { useState, useEffect, useRef } from "react";
import { getBearerToken, useSession } from "../api/auth.ts";
import { useNavigate, useLocation } from "react-router-dom";
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
    creatorId: string;
    createdAt: string;
}

type RoomJoinRequest = {
    id: string;
    roomId: string;
    userId: string;
    user_name?: string;
    status: "pending" | "accepted" | "rejected";
};

interface MessageItem {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    aiSource?: string | null;
    status: "sent" | "delivered" | "read";
    deliveredAt: string | null;
    readAt: string | null;
    replyToId?: string | null;
    reactions?: Array<{ emoji: string, userId: string }>;
}

interface DashboardData {
    users: UserItem[];
    rooms: RoomItem[];
}

type FriendRequestItem = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: "pending" | "accepted" | "rejected" | "cancelled";
    created_at?: string;
    from_user_name?: string;
    to_user_name?: string;
};

type MessageRequestItem = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    content: string;
    status: "pending" | "accepted" | "rejected";
    created_at?: string;
    from_user_name?: string;
    to_user_name?: string;
};

type FriendListItem = {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    friendedAt?: string;
};

type RelationshipStatus = "ACCEPTED" | "PENDING" | "NONE";

type ServerMessage = {
    id: string;
    senderId: string;
    text: string;
    timestamp: string;
    aiSource?: string | null;
    status?: "sent" | "delivered" | "read";
    deliveredAt?: string | null;
    readAt?: string | null;
    replyToId?: string | null;
};

const mapServerMessage = (msg: ServerMessage): MessageItem => ({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.text,
    createdAt: msg.timestamp,
    aiSource: msg.aiSource ?? null,
    status: msg.status ?? "sent",
    deliveredAt: msg.deliveredAt ?? null,
    readAt: msg.readAt ?? null,
    replyToId: msg.replyToId ?? null,
});

const authHeaders = (token: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
});

const normalizeSearchText = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

const API_BASE =
    (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ??
    `${(globalThis as typeof globalThis & { location?: { protocol: string; hostname: string } }).location?.protocol ?? "http:"}//${(globalThis as typeof globalThis & {
        location?: { protocol: string; hostname: string };
    }).location?.hostname ?? "localhost"}:3000`;

const getAvatarToken = (name?: string | null) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return "?";

    const parts = trimmed.split(/\s+/).filter(Boolean);
    const [firstPart = "", secondPart = ""] = parts;
    if (parts.length === 1) {
        return firstPart.slice(0, 1).toUpperCase();
    }

    return `${firstPart.slice(0, 1)}${secondPart.slice(0, 1)}`.toUpperCase();
};

const getStatusLabel = (msg: MessageItem) => {
    if (msg.status === "read") return "Read";
    if (msg.status === "delivered") return "Delivered";
    return "Sent";
};

const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-[#2A2248] rounded ${className}`} />
);

const notifyUser = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
    }
};

const LinkPreview = ({ url }: { url: string }) => {
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/metadata?url=${encodeURIComponent(url)}`, {
                    headers: { Authorization: `Bearer ${getBearerToken()}` }
                });
                if (res.ok) setMeta(await res.json());
            } catch (e) {
                console.error("Meta fetch failed", e);
            } finally {
                setLoading(false);
            }
        };
        fetchMeta();
    }, [url]);

    if (loading) return <Skeleton className="mt-2 h-24 w-full" />;
    if (!meta || (!meta.title && !meta.image)) return null;

    return (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 flex flex-col overflow-hidden rounded border border-[#3A325B] bg-[#1A1434]/50 transition hover:bg-[#1A1434]">
            {meta.image && <img src={meta.image} alt="" className="h-24 w-full object-cover" />}
            <div className="p-3">
                <p className="text-xs font-bold text-[#F1EDFF] line-clamp-1">{meta.title}</p>
                {meta.description && <p className="mt-1 text-[10px] text-[#A298C3] line-clamp-2">{meta.description}</p>}
                <p className="mt-2 text-[9px] text-[#6E62A3] uppercase tracking-wider">{new URL(url).hostname}</p>
            </div>
        </a>
    );
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
        fetch(`${API_BASE}/api/users`, {
            headers: { Authorization: "Bearer " + bearerToken },
        }),
        fetch(`${API_BASE}/api/rooms`, {
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
    const navigate = useNavigate();
    const { data: session, isPending } = useSession();
    const [activeChat, setActiveChat] = useState<ActiveUser>({ id: null, type: null });
    const [data, setData] = useState<DashboardData>({ users: [], rooms: [] });
    const [messageDraft, setMessageDraft] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);

    const handleToggleReaction = async (messageId: string, emoji: string) => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/messages/react`, {
                method: "POST",
                headers: authHeaders(bearerToken),
                body: JSON.stringify({ messageId, emoji }),
            });
            if (res.ok) {
                // Optimistically update or wait for WS? 
                // Let's update locally for immediate feedback
                setMessages(prev => prev.map(m => {
                    if (m.id === messageId) {
                        const existing = m.reactions?.find(r => r.userId === session?.user.id && r.emoji === emoji);
                        const nextReactions = existing
                            ? m.reactions?.filter(r => r !== existing)
                            : [...(m.reactions || []), { emoji, userId: session?.user.id! }];
                        return { ...m, reactions: nextReactions };
                    }
                    return m;
                }));
            }
        } catch (err) {
            console.error("Reaction failed", err);
        }
    };
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentUserId = session?.user.id;
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const chatId = params.get("chatId");
        const chatType = params.get("chatType") as "direct" | "room" | null;

        if (chatId && chatType) {
            setActiveChat({ id: chatId, type: chatType });
        }
    }, [location.search]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
    const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const wsRef = useRef<WebSocket | null>(null);
    const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [messageSearchQuery, setMessageSearchQuery] = useState("");
    const [messageSearchResults, setMessageSearchResults] = useState<{ private: any[], rooms: any[], discoveredRooms?: any[] } | null>(null);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTab, setSearchTab] = useState<"messages" | "users" | "rooms">("messages");
    const [showNotifications, setShowNotifications] = useState(false);
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
    const [selectedProfileUser, setSelectedProfileUser] = useState<UserItem | null>(null);

    const [unreadDirect, setUnreadDirect] = useState<Record<string, number>>({});
    const [unreadRooms, setUnreadRooms] = useState<Record<string, number>>({});
    const [lastSeenRooms, setLastSeenRooms] = useState<Record<string, string>>({});
    const [sidebarMode, setSidebarMode] = useState<"direct" | "room" | "requests" | "message_search" | "room_discover" | null>(null);
    const [allRooms, setAllRooms] = useState<RoomItem[]>([]);
    const [friendRequestsIncoming, setFriendRequestsIncoming] = useState<FriendRequestItem[]>([]);
    const [friendRequestsOutgoing, setFriendRequestsOutgoing] = useState<FriendRequestItem[]>([]);
    const [messageRequestsIncoming, setMessageRequestsIncoming] = useState<MessageRequestItem[]>([]);
    const [friends, setFriends] = useState<FriendListItem[]>([]);
    const [requestActionError, setRequestActionError] = useState<string | null>(null);
    const [requestActionInfo, setRequestActionInfo] = useState<string | null>(null);
    const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);
    const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>("ACCEPTED");
    const [chatRestricted, setChatRestricted] = useState(false);
    const [roomJoinRequests, setRoomJoinRequests] = useState<RoomJoinRequest[]>([]);
    const [roomInvites, setRoomInvites] = useState<any[]>([]);

    const handleRequestJoinRoom = async (roomId: string) => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/rooms/${roomId}/request-join`, {
                method: "POST",
                headers: authHeaders(bearerToken),
            });
            if (res.ok) {
                setRequestActionInfo("Join request sent to room creator.");
            } else {
                setRequestActionError("Failed to send join request.");
            }
        } catch (err) {
            console.error("Join request failed", err);
        }
    };

    const handleRespondJoinRoom = async (requestId: string, action: 'accept' | 'reject') => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/rooms/join-requests/${requestId}/respond`, {
                method: "POST",
                headers: authHeaders(bearerToken),
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                setRoomJoinRequests(prev => prev.filter(r => r.id !== requestId));
                // If accepted, maybe refresh room list or membership
                fetchSidebarData(setData);
            }
        } catch (err) {
            console.error("Respond join request failed", err);
        }
    };

    const handleRespondRoomInvite = async (inviteId: string, action: 'accept' | 'reject') => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/rooms/invites/${inviteId}/respond`, {
                method: "POST",
                headers: authHeaders(bearerToken),
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                setRoomInvites(prev => prev.filter(i => i.id !== inviteId));
                fetchSidebarData(setData);
                setRequestActionInfo(action === 'accept' ? "Joined room!" : "Invite declined.");
            }
        } catch (err) {
            console.error("Respond invite failed", err);
        }
    };

    const handleInviteToRoom = async (roomId: string, userId: string) => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/rooms/${roomId}/invite`, {
                method: "POST",
                headers: authHeaders(bearerToken),
                body: JSON.stringify({ userId }),
            });
            if (res.ok) {
                setRequestActionInfo("Invitation sent!");
            } else {
                const txt = await res.text();
                setRequestActionError(txt || "Failed to send invite.");
            }
        } catch (err) {
            console.error("Invite failed", err);
        }
    };

    const openUserProfile = async (userId: string) => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${bearerToken}` }
            });
            if (res.ok) {
                setSelectedProfileUser(await res.json());
            }
        } catch (err) {
            console.error("Failed to load user profile", err);
        }
    };

    const getSenderDisplayName = (senderId: string) => {
        if (senderId === "gemini-bot") {
            return "Gemini";
        }

        if (senderId === currentUserId) {
            return session?.user.name?.trim() || "You";
        }

        const found = data.users.find((u) => u.id === senderId);
        return found?.name?.trim() || found?.email?.trim() || senderId.slice(0, 8);
    };



    const loadRequestData = async () => {
        const bearerToken = getBearerToken();
        if (!bearerToken) return;

        const [friendReqRes, messageReqRes, friendsRes, roomInvitesRes, roomJoinRes] = await Promise.all([
            fetch(`${API_BASE}/api/friend-requests`, { headers: { Authorization: `Bearer ${bearerToken}` } }),
            fetch(`${API_BASE}/api/message-requests`, { headers: { Authorization: `Bearer ${bearerToken}` } }),
            fetch(`${API_BASE}/api/friends`, { headers: { Authorization: `Bearer ${bearerToken}` } }),
            fetch(`${API_BASE}/api/rooms/invites`, { headers: { Authorization: `Bearer ${bearerToken}` } }),
            fetch(`${API_BASE}/api/rooms/join-requests`, { headers: { Authorization: `Bearer ${bearerToken}` } }),
        ]);

        if (friendReqRes.ok) {
            const payload = (await friendReqRes.json()) as {
                incoming: FriendRequestItem[];
                outgoing: FriendRequestItem[];
            };
            setFriendRequestsIncoming(payload.incoming ?? []);
            setFriendRequestsOutgoing(payload.outgoing ?? []);
        }
        if (messageReqRes.ok) {
            const payload = (await messageReqRes.json()) as MessageRequestItem[];
            setMessageRequestsIncoming(payload.filter((r) => r.status === "pending"));
        }
        if (friendsRes.ok) {
            const payload = (await friendsRes.json()) as FriendListItem[];
            setFriends(payload);
        }
        if (roomInvitesRes.ok) {
            setRoomInvites(await roomInvitesRes.json() || []);
        }
        if (roomJoinRes.ok) {
            setRoomJoinRequests(await roomJoinRes.json() || []);
        }
    };

    const runRequestAction = async (key: string, action: () => Promise<Response>, successMessage: string) => {
        try {
            setRequestActionLoading(key);
            setRequestActionError(null);
            setRequestActionInfo(null);
            const res = await action();
            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || "Action failed");
            }
            setRequestActionInfo(successMessage);
            await loadRequestData();
        } catch (err) {
            setRequestActionError(err instanceof Error ? err.message : "Action failed");
        } finally {
            setRequestActionLoading(null);
        }
    };



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
                openUserProfile(localMatch.id);
                setSearchQuery("");
                return;
            }

            if (bearerToken) {
                const usersRes = await fetch(`${API_BASE}/api/users`, {
                    headers: { Authorization: `Bearer ${bearerToken}` },
                });

                if (usersRes.ok) {
                    const users = (await usersRes.json()) as UserItem[];
                    setData((prev) => ({ ...prev, users }));

                    const refreshedMatch = findInUsers(users);
                    if (refreshedMatch) {
                        openUserProfile(refreshedMatch.id);
                        setSearchQuery("");
                        return;
                    }
                }
            }

            const res = await fetch(`${API_BASE}/api/users/${rawQuery}`, {
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                },
            });
            if (res.ok) {
                const foundUser = (await res.json()) as UserItem;
                openUserProfile(foundUser.id);
                setData(prev => ({
                    ...prev,
                    users: prev.users.some(u => u.id === foundUser.id) ? prev.users : [...prev.users, foundUser]
                }));
                setSearchQuery("");
            } else {
                (globalThis as { alert?: (message: string) => void }).alert?.("User not found.");
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const run = async () => {
            if (isPending || !session) return;
            setIsLoading(true);
            try {
                const bearerToken = getBearerToken();
                if (!bearerToken) return;

                // 1. Fetch presence
                const presenceRes = await fetch(`${API_BASE}/api/presence`, {
                    headers: { Authorization: `Bearer ${bearerToken}` }
                });
                if (presenceRes.ok) {
                    const presence = await presenceRes.json();
                    setOnlineUsers(new Set(presence.online || []));
                    setLastSeen(presence.lastSeen || {});
                }

                // 2. Fetch sidebar data
                const sidebar = await fetchSidebarData(setData);
                if (sidebar) {
                    await refreshUnreadCounts(sidebar.users, sidebar.rooms);
                }

                // 3. Load other requests
                await loadRequestData();
            } catch (err) {
                console.error("Initial load failed", err);
                setError("Failed to load dashboard data");
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
                await loadRequestData();
            } catch {
                // keep silent during polling
            }
        }, 10000);

        return () => clearInterval(id);
    }, [session, activeChat.id, activeChat.type, lastSeenRooms]);

    useEffect(() => {
        if (!session) return;
        const wsProtocol = API_BASE.startsWith("https://") ? "wss" : "ws";
        const wsUrl = API_BASE.replace(/^https?/, wsProtocol) + "/chat";
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = async (event) => {
            try {
                const parsed = JSON.parse(String(event.data)) as {
                    type?: string;
                    data?: any;
                };
                if (!parsed || !parsed.type) return;
                if (parsed.type === "friend-request-updated" || parsed.type === "message-request-updated") {
                    await loadRequestData();
                    if (activeChat.type === "direct" && activeChat.id) {
                        const bearerToken = getBearerToken();
                        if (bearerToken) {
                            const res = await fetch(`${API_BASE}/api/messages/${activeChat.id}`, {
                                headers: { Authorization: `Bearer ${bearerToken}` },
                            });
                            if (res.ok) {
                                const payload = (await res.json()) as
                                    | ServerMessage[]
                                    | { status: RelationshipStatus; history: ServerMessage[]; restricted: boolean };
                                if (!Array.isArray(payload)) {
                                    setRelationshipStatus(payload.status ?? "NONE");
                                    setChatRestricted(Boolean(payload.restricted));
                                }
                            }
                        }
                    }
                }

                if (parsed.type === "room_invite") {
                    await loadRequestData();
                    setRequestActionInfo("You have a new room invitation!");
                }

                if (parsed.type === "chat-message" || parsed.type === "room_message") {
                    const msg = mapServerMessage((parsed as any).data);
                    // Only update messages if it's the current chat
                    const isCorrectChat = (parsed.type === "chat-message" && activeChat.type === "direct" && (msg.senderId === activeChat.id || msg.senderId === session.user.id))
                        || (parsed.type === "room_message" && activeChat.type === "room" && (parsed as any).data.roomId === activeChat.id);

                    if (isCorrectChat) {
                        setMessages((prev) => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                    }

                    if (document.visibilityState !== "visible") {
                        const sender = parsed.type === "chat-message" ? `User ${msg.senderId}` : "Room";
                        notifyUser(`New message from ${sender}`, msg.content);
                    }
                }

                if (parsed.type === "message_reaction") {
                    const { messageId, userId, emoji } = (parsed as any).data;
                    setMessages((prev) => prev.map(m => {
                        if (m.id === messageId) {
                            const existing = m.reactions?.find(r => r.userId === userId && r.emoji === emoji);
                            const nextReactions = existing
                                ? m.reactions?.filter(r => r !== existing)
                                : [...(m.reactions || []), { emoji, userId }];
                            return { ...m, reactions: nextReactions };
                        }
                        return m;
                    }));
                }

                if (parsed.type === "presence_change") {
                    const { userId, status, timestamp } = (parsed as any).data;
                    setOnlineUsers((prev) => {
                        const next = new Set(prev);
                        if (status === "online") next.add(userId);
                        else next.delete(userId);
                        return next;
                    });
                    if (status === "offline" && timestamp) {
                        setLastSeen(prev => ({ ...prev, [userId]: timestamp }));
                    }
                }

                if (parsed.type === "typing") {
                    const { fromUserId, isTyping } = (parsed as any).data;
                    setTypingStatus((prev) => ({
                        ...prev,
                        [fromUserId]: isTyping
                    }));
                }
            } catch {
                // ignore malformed ws payloads
            }
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [session, activeChat.id, activeChat.type]);


    type SendMessageResponse =
        | ServerMessage
        | {
            userMessage: ServerMessage;
            aiMessage?: ServerMessage;
        }
        | {
            status: "request_sent";
            message: string;
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

    const isRequestSentResponse = (
        payload: SendMessageResponse,
    ): payload is { status: "request_sent"; message: string } => {
        return (
            typeof payload === "object" &&
            payload !== null &&
            "status" in payload &&
            payload.status === "request_sent"
        );
    };

    const emitTyping = (isTyping: boolean) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeChat.id || activeChat.type !== "direct") return;

        wsRef.current.send(JSON.stringify({
            type: "typing",
            data: { to: activeChat.id, isTyping }
        }));
    };

    const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMessageDraft(val);

        if (activeChat.type === "direct" && activeChat.id) {
            // Start typing
            if (!typingTimeoutRef.current[activeChat.id]) {
                emitTyping(true);
            }

            // Clear old timeout
            if (typingTimeoutRef.current[activeChat.id]) {
                clearTimeout(typingTimeoutRef.current[activeChat.id]);
            }

            // Set new timeout to stop typing
            typingTimeoutRef.current[activeChat.id] = setTimeout(() => {
                emitTyping(false);
                delete typingTimeoutRef.current[activeChat.id!];
            }, 3000);
        }
    };
    const handleMessageSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageSearchQuery.trim()) return;

        setIsSearchingMessages(true);
        try {
            const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(messageSearchQuery)}`, {
                headers: { Authorization: `Bearer ${getBearerToken()}` }
            });
            if (res.ok) {
                setMessageSearchResults(await res.json());
            }
        } catch (err) {
            console.error("Message search failed", err);
        } finally {
            setIsSearchingMessages(false);
        }
    };
    const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (activeChat.type === "direct" && activeChat.id) {
            emitTyping(false);
            if (typingTimeoutRef.current[activeChat.id]) {
                clearTimeout(typingTimeoutRef.current[activeChat.id]);
                delete typingTimeoutRef.current[activeChat.id];
            }
        }

        if (!activeChat.id || !activeChat.type) {
            setSendError("Select a user or room before sending.");
            return;
        }
        if (activeChat.type === "direct" && relationshipStatus === "PENDING") {
            setSendError("You cannot send more messages while your request is pending.");
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

            const response = await fetch(`${API_BASE}/api/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${bearerToken}`,
                },
                body: JSON.stringify({
                    targetId: activeChat.id,
                    content: trimmedMessage,
                    type: activeChat.type,
                    replyToId: replyingTo?.id,
                }),
            });
            setReplyingTo(null);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Failed to send message");
            }

            const payload = (await response.json()) as SendMessageResponse;

            if (isRequestSentResponse(payload)) {
                setRequestActionInfo(payload.message);
                setMessageDraft("");
                // Refresh status
                const endpoint = `${API_BASE}/api/messages/${activeChat.id}`;
                const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${bearerToken}` } });
                if (res.ok) {
                    const data = await res.json();
                    if (!Array.isArray(data)) {
                        setRelationshipStatus(data.status ?? "PENDING");
                        setChatRestricted(Boolean(data.restricted));
                    }
                }
                return;
            }

            if (hasAiPayload(payload)) {
                setMessages((prev) => {
                    let next = [...prev];
                    const userMsg = mapServerMessage(payload.userMessage);
                    if (!next.some(m => m.id === userMsg.id)) next.push(userMsg);

                    if (payload.aiMessage) {
                        const aiMsg = mapServerMessage(payload.aiMessage);
                        if (!next.some(m => m.id === aiMsg.id)) next.push(aiMsg);
                    }
                    return next;
                });
            } else {
                setMessages((prev) => {
                    const msg = mapServerMessage(payload as any);
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            }

            setMessageDraft("");
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
                        ? `${API_BASE}/api/messages/${activeChat.id}`
                        : `${API_BASE}/api/rooms/${activeChat.id}/messages`;

                const response = await fetch(endpoint,
                    {
                        headers: {
                            Authorization: `Bearer ${bearerToken}`,
                        },
                    },
                );

                if (!response.ok) {
                    if (response.status === 403) {
                        const txt = await response.text();
                        throw new Error(txt);
                    }
                    throw new Error("Failed to fetch messages");
                }

                const payload = (await response.json()) as
                    | ServerMessage[]
                    | { status: RelationshipStatus; history: ServerMessage[]; restricted: boolean };
                const effectiveHistory = Array.isArray(payload) ? payload : (payload.history ?? []);

                if (activeChat.type === "direct" && !Array.isArray(payload)) {
                    setRelationshipStatus(payload.status ?? "NONE");
                    setChatRestricted(Boolean(payload.restricted));
                    setMessages(effectiveHistory.map(mapServerMessage));
                } else {
                    setRelationshipStatus("ACCEPTED");
                    setChatRestricted(false);
                    setMessages(effectiveHistory.map(mapServerMessage));
                }

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
                        const refreshedPayload = (await refreshed.json()) as
                            | ServerMessage[]
                            | { status: RelationshipStatus; history: ServerMessage[]; restricted: boolean };
                        const refreshedHistory = Array.isArray(refreshedPayload)
                            ? refreshedPayload
                            : (refreshedPayload.history ?? []);
                        setMessages(refreshedHistory.map(mapServerMessage));

                        if (!Array.isArray(refreshedPayload)) {
                            setRelationshipStatus(refreshedPayload.status ?? "NONE");
                            setChatRestricted(Boolean(refreshedPayload.restricted));
                        } else {
                            setRelationshipStatus("ACCEPTED");
                            setChatRestricted(false);
                        }
                    }

                    setUnreadDirect((prev) => ({ ...prev, [activeChat.id as string]: 0 }));
                } else {
                    const roomHistory = effectiveHistory as RoomHistoryMessage[];
                    const latest = roomHistory.length > 0 ? roomHistory[roomHistory.length - 1]?.timestamp ?? null : null;
                    if (latest) {
                        setLastSeenRooms((prev) => ({ ...prev, [activeChat.id as string]: latest }));
                    }
                    setUnreadRooms((prev) => ({ ...prev, [activeChat.id as string]: 0 }));
                }
            } catch (err: any) {
                setError(err.message);
                setRelationshipStatus("NONE");
                setChatRestricted(false);
                setMessages([]);
            }
        };

        fetchMessages();
    }, [activeChat.id, activeChat.type]);

    useEffect(() => {
        if (scrollRef.current) {
            (scrollRef.current as unknown as { scrollIntoView?: (options?: { behavior?: string }) => void })
                .scrollIntoView?.({ behavior: "smooth" });
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
                    const res = await fetch(`${API_BASE}/api/messages/${u.id}`, {
                        headers: { Authorization: `Bearer ${bearerToken}` },
                    });
                    if (!res.ok) return [u.id, 0] as const;


                    const payload = (await res.json()) as
                        | ServerMessage[]
                        | { status: RelationshipStatus; history: ServerMessage[]; restricted: boolean };
                    const history = Array.isArray(payload) ? payload : (payload.history ?? []);
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
                    const res = await fetch(`${API_BASE}/api/rooms/${r.id}/messages`, {
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

            const response = await fetch(`${API_BASE}/api/rooms/create`, {
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
                <aside className="flex w-24 shrink-0 flex-col items-center border-r border-[#24203B] bg-[rgba(2,2,10,0.9)] px-3 py-6 overflow-y-auto">
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
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`mb-4 flex w-full flex-col items-center gap-1 border px-2 py-2 text-[9px] tracking-[0.2em] uppercase transition ${showNotifications
                            ? "border-[#6C619A] bg-[#15122A] text-[#E6E3F5]"
                            : "border-transparent text-[#7F78A3] hover:border-[#3A335A] hover:bg-[#0F0C21]"
                            }`}
                    >
                        <div className="relative">
                            <span className="text-sm">🔔</span>
                            {(friendRequestsIncoming.length + roomJoinRequests.length + roomInvites.length) > 0 && (
                                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.6)]" />
                            )}
                        </div>
                        Alerts
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

                    <button
                        type="button"
                        onClick={() => setSidebarMode(sidebarMode === "message_search" ? null : "message_search")}
                        className={`mt-4 flex w-full flex-col items-center gap-1 border px-2 py-2 text-[9px] tracking-[0.2em] uppercase transition ${sidebarMode === "message_search"
                            ? "border-[#6C619A] bg-[#15122A] text-[#E6E3F5]"
                            : "border-transparent text-[#7F78A3] hover:border-[#3A335A] hover:bg-[#0F0C21]"
                            }`}
                    >
                        <span className="text-sm">⌕</span>
                        Search
                    </button>

                    <div className="mt-auto w-full border-t border-[#2B2545] pt-6 flex flex-col items-center gap-3">
                        <div
                            className="h-10 w-10 rounded-full border border-[#4B426F] bg-[#1A1534] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#F1EDFF] transition"
                            title={session?.user.email}
                        >
                            {session?.user.image ? (
                                <img src={session.user.image} alt="User" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-[11px] font-bold text-[#EDE7FF]">
                                    {getAvatarToken(session?.user.name)}
                                </span>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] font-bold tracking-[0.1em] text-[#D6D0EF] truncate max-w-[80px]">
                                {session?.user.name?.split(' ')[0] || "User"}
                            </p>
                            <p className="text-[7px] tracking-[0.2em] text-[#635C84] uppercase mt-0.5">Connected</p>
                        </div>
                    </div>
                </aside>

                {/* Sliding Contacts Drawer */}
                <div
                    className={`border-r border-[#24203B] bg-[rgba(8,6,20,0.92)] backdrop-blur-xl transition-all duration-300 overflow-hidden ${sidebarMode ? "w-80" : "w-0"
                        }`}
                >
                    <div className="flex h-full flex-col p-6">
                        <div className="mb-8">
                            <h3 className="mb-4 text-[12px] font-bold tracking-[0.25em] text-[#A79FC8] uppercase">
                                {sidebarMode === "direct" ? "Messages" : sidebarMode === "room" ? "Channels" : "Nav"}
                            </h3>

                            {/* Integrated Search Bar at the Top */}
                            <div className="group relative">
                                <input
                                    type="text"
                                    value={messageSearchQuery}
                                    onChange={(e) => {
                                        setMessageSearchQuery(e.target.value);
                                        setSearchQuery(e.target.value);
                                    }}
                                    placeholder={sidebarMode === "direct" ? "Find a contact..." : sidebarMode === "room" ? "Find a room..." : "Search everything..."}
                                    className="w-full rounded-lg border border-[#2B2450] bg-[#0A081A] py-2.5 pl-9 pr-3 text-[11px] text-[#F1EDFF] placeholder-[#4A4273] outline-none ring-1 ring-transparent transition-all focus:border-[#6C619A] focus:ring-[#6C619A]/30"
                                />
                                <span className="absolute left-3 top-2.5 text-sm text-[#4A4273] transition-colors group-focus-within:text-[#6C619A]">⌕</span>
                            </div>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                            {sidebarMode === "room" && (
                                <button
                                    onClick={async () => {
                                        setSidebarMode("room_discover");
                                        const res = await fetch(`${API_BASE}/api/rooms/all`, {
                                            headers: { Authorization: `Bearer ${getBearerToken()}` }
                                        });
                                        if (res.ok) setAllRooms(await res.json());
                                    }}
                                    className="mb-4 w-full rounded border border-dashed border-[#4A4273] py-2 text-[10px] font-bold tracking-widest text-[#A298C3] uppercase transition hover:border-[#6C619A] hover:text-[#D9D2F1]"
                                >
                                    + Discover More Rooms
                                </button>
                            )}

                            {sidebarMode === "room_discover" && (
                                <div className="mb-4">
                                    <button
                                        onClick={() => setSidebarMode("room")}
                                        className="mb-3 block text-[9px] font-bold text-[#6E62A3] uppercase tracking-widest hover:text-[#D9D2F1]"
                                    >
                                        ← Back to My Rooms
                                    </button>
                                    <div className="space-y-1.5">
                                        {allRooms
                                            .filter(r => !data.rooms.some(myR => myR.id === r.id))
                                            .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map(r => (
                                                <div key={r.id} className="flex items-center justify-between rounded border border-[#2B2450] bg-[#0F0C21] p-2.5">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-medium text-[#D9D2F1]"># {r.name}</p>
                                                        <p className="text-[8px] text-[#6E62A3] uppercase">Private Room</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRequestJoinRoom(r.id)}
                                                        className="ml-2 rounded bg-[#2A2248] px-2 py-1 text-[9px] font-bold text-[#F1EDFF] transition hover:bg-[#3A335D]"
                                                    >
                                                        JOIN
                                                    </button>
                                                </div>
                                            ))}
                                        {allRooms.length > 0 && allRooms.filter(r => !data.rooms.some(myR => myR.id === r.id)).filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                            <p className="py-4 text-center text-[10px] text-[#6E62A3]">No new rooms found.</p>
                                        )}
                                    </div>
                                </div>
                            )}



                            {sidebarMode === "message_search" && (
                                <div className="mb-4 space-y-4">
                                    <div className="flex border-b border-[#2B2450] mb-2">
                                        {["messages", "users", "rooms"].map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => {
                                                    setSearchTab(tab as any);
                                                    if (tab === "rooms" && allRooms.length === 0) {
                                                        const bearerToken = getBearerToken();
                                                        if (bearerToken) {
                                                            fetch(`${API_BASE}/api/rooms/all`, {
                                                                headers: { Authorization: `Bearer ${bearerToken}` }
                                                            }).then(res => res.json()).then(setAllRooms);
                                                        }
                                                    }
                                                }}
                                                className={`flex-1 pb-2 text-[10px] font-bold uppercase tracking-widest transition ${searchTab === tab ? "text-[#F1EDFF] border-b-2 border-[#6C619A]" : "text-[#6E62A3] hover:text-[#D9D2F1]"}`}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                    {isSearchingMessages && (
                                        <div className="flex items-center gap-2 text-[9px] text-emerald-400">
                                            <div className="h-2 w-2 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                                            Searching...
                                        </div>
                                    )}

                                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                                        {searchTab === "messages" && (
                                            <div className="space-y-4">
                                                {messageSearchResults ? (
                                                    <div className="space-y-4">
                                                        {messageSearchResults.private.length > 0 && (
                                                            <div className="space-y-1.5">
                                                                <p className="text-[9px] font-bold text-[#8D83B2] uppercase">Direct Messages</p>
                                                                {messageSearchResults.private.map((m: any) => (
                                                                    <button
                                                                        key={m.id}
                                                                        onClick={() => setActiveChat({ id: m.senderId === session?.user.id ? m.receiverId : m.senderId, type: "direct" })}
                                                                        className="w-full rounded border border-[#2B2450] bg-[#0F0C21] p-2 text-left hover:border-[#4A4273]"
                                                                    >
                                                                        <p className="truncate text-[10px] font-bold text-[#D6D0EF]">{m.sender_name}</p>
                                                                        <p className="mt-0.5 truncate text-[10px] text-[#8D83B2]">{m.text || m.content}</p>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {messageSearchResults.rooms.length > 0 && (
                                                            <div className="space-y-1.5">
                                                                <p className="text-[9px] font-bold text-[#8D83B2] uppercase">Room Messages</p>
                                                                {messageSearchResults.rooms.map((m: any) => (
                                                                    <button
                                                                        key={m.id}
                                                                        onClick={() => setActiveChat({ id: m.roomId, type: "room" })}
                                                                        className="w-full rounded border border-[#2B2450] bg-[#0F0C21] p-2 text-left hover:border-[#4A4273]"
                                                                    >
                                                                        <div className="flex justify-between">
                                                                            <p className="truncate text-[10px] font-bold text-[#D6D0EF]"># {m.room_name}</p>
                                                                            <p className="text-[8px] text-[#6E62A3]">{m.sender_name}</p>
                                                                        </div>
                                                                        <p className="mt-0.5 truncate text-[10px] text-[#8D83B2]">{m.text || m.content}</p>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {messageSearchResults.private.length === 0 && messageSearchResults.rooms.length === 0 && (
                                                            <p className="text-center text-[10px] text-[#8D83B2]">No message results found.</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-center text-[10px] text-[#6E62A3]">Search for keywords in messages.</p>
                                                )}
                                            </div>
                                        )}

                                        {searchTab === "users" && (
                                            <div className="space-y-1.5">
                                                <p className="text-[9px] font-bold text-[#8D83B2] uppercase">All Users</p>
                                                {data.users
                                                    .filter(u => u.name?.toLowerCase().includes(messageSearchQuery.toLowerCase()) || u.email?.toLowerCase().includes(messageSearchQuery.toLowerCase()))
                                                    .map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => setActiveChat({ id: u.id, type: "direct" })}
                                                            className="flex w-full items-center gap-2 rounded border border-[#2B2450] bg-[#0F0C21] p-2 text-left hover:border-[#4A4273]"
                                                        >
                                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2A2248] text-[8px] font-bold text-[#F1EDFF]">
                                                                {getAvatarToken(u.name)}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-[10px] font-bold text-[#D6D0EF]">{u.name || u.email}</p>
                                                                <p className="text-[8px] text-[#6E62A3] uppercase">{onlineUsers.has(u.id) ? "Online" : "Offline"}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                            </div>
                                        )}

                                        {searchTab === "rooms" && (
                                            <div className="space-y-6">
                                                {/* My Rooms */}
                                                <div className="space-y-1.5">
                                                    <p className="text-[9px] font-bold text-[#8D83B2] uppercase">My Rooms</p>
                                                    {data.rooms
                                                        .filter(r => r.name.toLowerCase().includes(messageSearchQuery.toLowerCase()))
                                                        .map(r => (
                                                            <button
                                                                key={r.id}
                                                                onClick={() => setActiveChat({ id: r.id, type: "room" })}
                                                                className="flex w-full items-center gap-2 rounded border border-[#2B2450] bg-[#0F0C21] p-2 text-left hover:border-[#4A4273]"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-[10px] font-bold text-[#D6D0EF]"># {r.name}</p>
                                                                </div>
                                                            </button>
                                                        ))}
                                                </div>

                                                {/* Global Rooms Discovery */}
                                                <div className="space-y-1.5 pt-4 border-t border-[#2B2450]">
                                                    <p className="text-[9px] font-bold text-[#8D83B2] uppercase">Discover All Rooms</p>
                                                    {allRooms
                                                        .filter(r => !data.rooms.some(myR => myR.id === r.id))
                                                        .filter(r => r.name.toLowerCase().includes(messageSearchQuery.toLowerCase()))
                                                        .map(r => (
                                                            <div key={r.id} className="flex items-center justify-between rounded border border-[#2B2450] bg-[#0F0C21] p-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-[10px] font-bold text-[#D6D0EF]"># {r.name}</p>
                                                                    <p className="text-[8px] text-[#6E62A3] uppercase">Global Room</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRequestJoinRoom(r.id)}
                                                                    className="ml-2 rounded bg-[#2A2248] px-2 py-1 text-[8px] font-bold text-[#F1EDFF] transition hover:bg-[#3A335D]"
                                                                >
                                                                    JOIN
                                                                </button>
                                                            </div>
                                                        ))}
                                                    {allRooms.filter(r => !data.rooms.some(myR => myR.id === r.id)).length === 0 && (
                                                        <p className="text-center text-[9px] text-[#6E62A3]">No new rooms found.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

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
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-medium">{u.name || u.email || "Unknown"}</p>
                                                {onlineUsers.has(u.id) && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                                )}
                                            </div>
                                            <p className="text-[9px] tracking-[0.08em] text-[#8178A0]">USER</p>
                                            {!onlineUsers.has(u.id) && lastSeen[u.id] && (
                                                <p className="mt-0.5 text-[8px] text-[#6E62A3]">
                                                    Last seen: {new Date(lastSeen[u.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                        {((unreadDirect[u.id] ?? 0) > 0) && (
                                            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D95A6F] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                                {(unreadDirect[u.id] ?? 0) > 99 ? "99+" : (unreadDirect[u.id] ?? 0)}
                                            </span>
                                        )}
                                    </button>
                                ))
                                : sidebarMode === "room" ? data.rooms.map((r) => (
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
                                        {((unreadRooms[r.id] ?? 0) > 0) && (
                                            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D95A6F] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                                {(unreadRooms[r.id] ?? 0) > 99 ? "99+" : (unreadRooms[r.id] ?? 0)}
                                            </span>
                                        )}
                                    </button>
                                )) : null}
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="relative flex flex-1 flex-col overflow-hidden">

                    <main className="relative flex-1 overflow-hidden border-l border-[#1D1734] bg-[linear-gradient(145deg,rgba(35,16,66,0.7)_0%,rgba(9,7,30,0.96)_45%,rgba(6,5,20,1)_100%)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_100%_at_20%_10%,rgba(163,140,223,0.18)_0%,rgba(24,18,48,0)_52%)]" />

                        {activeChat.id ? (
                            <div className="relative flex h-full flex-col">
                                <div className="flex items-start justify-between border-b border-[#272043] px-8 py-6">
                                    <div>
                                        <p className="text-[10px] tracking-[0.28em] text-[#8D83B2] uppercase">Active Thread</p>
                                        <div className="flex items-center gap-3">
                                            <h2 className="mt-2 text-4xl font-semibold tracking-[0.04em] text-[#F1EDFF]">
                                                {activeChat.type === "direct"
                                                    ? (data.users.find(u => u.id === activeChat.id)?.name || activeChat.id)
                                                    : activeChat.id
                                                }
                                            </h2>
                                            {activeChat.type === "direct" && onlineUsers.has(activeChat.id) && (
                                                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">Online</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="mt-1 text-[11px] tracking-[0.2em] text-[#A79FC8] uppercase">{activeChat.type}</p>
                                            {activeChat.type === "direct" && typingStatus[activeChat.id] && (
                                                <span className="mt-1 text-[11px] italic text-emerald-400 animate-pulse">is typing...</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#3A335D] bg-[#1A1434] text-[#8D83B2] transition hover:border-[#6F62A3] hover:text-[#D6D0EF]"
                                            title="Audio Call"
                                        >
                                            📞
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#3A335D] bg-[#1A1434] text-[#8D83B2] transition hover:border-[#6F62A3] hover:text-[#D6D0EF]"
                                            title="Video Call"
                                        >
                                            📹
                                        </button>
                                        <button
                                            onClick={() => setShowNotifications(!showNotifications)}
                                            className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#3A335D] bg-[#1A1534] transition hover:border-[#6C619A] hover:bg-[#251E4A]"
                                            title="Notifications"
                                        >
                                            <span className="text-sm">🔔</span>
                                            {(friendRequestsIncoming.length + roomJoinRequests.length + roomInvites.length) > 0 && (
                                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-lg">
                                                    {friendRequestsIncoming.length + roomJoinRequests.length + roomInvites.length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveChat({ id: null, type: null })}
                                            className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#3A335D] bg-[#1A1434] text-[#8D83B2] transition hover:border-[#D95A6F] hover:text-[#D95A6F]"
                                            title="Close Chat"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                {activeChat.id && activeChat.type === "room" && (
                                    (() => {
                                        const room = data.rooms.find(r => r.id === activeChat.id);
                                        const isCreator = room?.creatorId === currentUserId;
                                        // We'd need to know if we are a member. 
                                        // Let's check messages array or a specific membership state.
                                        // Simplest for now: if we failed to load messages, we are restricted.
                                        if (error === "Forbidden: Not a room member") {
                                            return (
                                                <div className="border-b border-[#3A335D]/50 bg-[#14102B]/60 px-8 py-4 backdrop-blur-md">
                                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2248] text-[#9C93BE]">🔒</div>
                                                            <div>
                                                                <p className="text-xs font-semibold tracking-wide text-[#F1EDFF]">Private Room</p>
                                                                <p className="text-[10px] text-[#8D83B2]">You must be a member to view this room.</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRequestJoinRoom(activeChat.id!)}
                                                            className="rounded border border-[#6E62A3] bg-[#2A2248] px-4 py-2 text-[10px] font-bold tracking-[0.12em] text-[#F1EDFF] uppercase transition hover:border-[#F1EDFF]"
                                                        >
                                                            Request to Join
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (isCreator) {
                                            // Optionally show button to view requests
                                            return (
                                                <div className="border-b border-[#3A335D]/50 bg-[#14102B]/30 px-8 py-2">
                                                    <button
                                                        onClick={async () => {
                                                            const res = await fetch(`${API_BASE}/api/rooms/${activeChat.id}/join-requests`, {
                                                                headers: { Authorization: `Bearer ${getBearerToken()}` }
                                                            });
                                                            if (res.ok) setRoomJoinRequests(await res.json());
                                                        }}
                                                        className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest hover:text-emerald-300"
                                                    >
                                                        Manage Join Requests ({roomJoinRequests.filter(r => r.roomId === activeChat.id).length})
                                                    </button>
                                                    {roomJoinRequests.filter(r => r.roomId === activeChat.id).map(req => (
                                                        <div key={req.id} className="mt-2 flex items-center justify-between bg-black/20 p-2 rounded">
                                                            <span className="text-[10px] text-[#D6D0EF]">{req.user_name} wants to join</span>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleRespondJoinRoom(req.id, 'accept')} className="text-[9px] text-emerald-400 font-bold">ACCEPT</button>
                                                                <button onClick={() => handleRespondJoinRoom(req.id, 'reject')} className="text-[9px] text-rose-400 font-bold">REJECT</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()
                                )}
                                {activeChat.type === "direct" && chatRestricted && activeChat.id && (
                                    <div className="border-b border-[#3A335D]/50 bg-[#14102B]/60 px-8 py-4 backdrop-blur-md">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2248] text-[#9C93BE]">
                                                    {relationshipStatus === "PENDING" ? "⏳" : "🔒"}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold tracking-wide text-[#F1EDFF]">
                                                        {relationshipStatus === "PENDING" ? "Request Pending" : "Message Request Required"}
                                                    </p>
                                                    <p className="text-[10px] text-[#8D83B2]">
                                                        {relationshipStatus === "PENDING"
                                                            ? "Waiting for the recipient to accept your chat request."
                                                            : "You need to send a request to start chatting with this user."}
                                                    </p>
                                                </div>
                                            </div>

                                            {relationshipStatus === "NONE" && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // focus the input to prompt sending a message as request
                                                        const input = document.querySelector('input[name="msg"]') as HTMLInputElement;
                                                        input?.focus();
                                                    }}
                                                    className="group relative overflow-hidden rounded border border-[#6E62A3] bg-[#2A2248] px-4 py-2 text-[10px] font-bold tracking-[0.12em] text-[#F1EDFF] uppercase transition hover:border-[#F1EDFF]"
                                                >
                                                    <span className="relative z-10">Send Request via Message</span>
                                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-1 flex-col overflow-hidden">
                                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
                                        {messages.length > 0 ? (
                                            messages.map((msg: MessageItem) => {
                                                const isGeminiGenerated =
                                                    msg.senderId === "gemini-bot" ||
                                                    msg.aiSource === "gemini" ||
                                                    /^Gemini:\s*/i.test(msg.content);
                                                const markdownContent = isGeminiGenerated
                                                    ? msg.content.replace(/^Gemini:\s*/i, "")
                                                    : msg.content;
                                                const isMe = !isGeminiGenerated && msg.senderId === currentUserId;
                                                const senderName = isGeminiGenerated ? "Gemini" : getSenderDisplayName(msg.senderId);
                                                const avatarToken = getAvatarToken(senderName);
                                                return (
                                                    <div key={msg.id} className={`group flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                        <div className={`max-w-[70%] border px-4 py-3 ${isMe
                                                            ? "border-[#6F62A3] bg-[#2A2248] text-[#F0ECFF]"
                                                            : "border-[#3A335D] bg-[#14102B] text-[#CDC6EA]"
                                                            }`}>
                                                            <div className={`mb-2 flex items-center gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openUserProfile(msg.senderId)}
                                                                    title="Open profile"
                                                                    aria-label={`Open ${senderName} profile`}
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#6F62A3] bg-[#1C1736] text-[10px] font-semibold text-[#EDE7FF]"
                                                                >
                                                                    {avatarToken}
                                                                </button>
                                                                <span className="text-[10px] tracking-[0.08em] text-[#B9B1D9]">
                                                                    {senderName}
                                                                </span>
                                                            </div>

                                                            {msg.replyToId && (
                                                                <div className="mb-2 border-l-2 border-[#6F62A3] bg-black/20 p-2 text-[10px] italic text-[#A298C3]">
                                                                    {messages.find(m => m.id === msg.replyToId)?.content || "Message deleted"}
                                                                </div>
                                                            )}
                                                            {isGeminiGenerated ? (
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
                                                                        {markdownContent}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                                                                    {(() => {
                                                                        const urlMatch = msg.content.match(/https?:\/\/[^\s]+/);
                                                                        return urlMatch ? <LinkPreview url={urlMatch[0]} /> : null;
                                                                    })()}
                                                                </>
                                                            )}
                                                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                                                {msg.reactions && msg.reactions.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                                                                            const count = msg.reactions?.filter(r => r.emoji === emoji).length;
                                                                            const hasReacted = msg.reactions?.some(r => r.userId === currentUserId && r.emoji === emoji);
                                                                            return (
                                                                                <button
                                                                                    key={emoji}
                                                                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                                    className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] transition ${hasReacted
                                                                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                                                                        : "border-[#3A335D] bg-[#1C1736] text-[#8D83B2] hover:border-[#6F62A3]"
                                                                                        }`}
                                                                                >
                                                                                    <span>{emoji}</span>
                                                                                    {count! > 1 && <span>{count}</span>}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                                                                        <button
                                                                            key={emoji}
                                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                            className="hover:scale-125 transition-transform"
                                                                            title={emoji}
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => {
                                                                            setReplyingTo(msg);
                                                                            const input = document.querySelector('input[name="msg"]') as HTMLInputElement;
                                                                            input?.focus();
                                                                        }}
                                                                        className="ml-1 text-[10px] text-[#6E62A3] hover:text-[#D6D0EF]"
                                                                        title="Reply"
                                                                    >
                                                                        Reply
                                                                    </button>
                                                                </div>
                                                            </div>
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
                                        {replyingTo && (
                                            <div className="flex items-center justify-between border-t border-[#3E3563] bg-[#1A1434] px-4 py-2 text-[10px] text-[#A298C3]">
                                                <div className="truncate">
                                                    <span className="font-bold">Replying to:</span> {replyingTo.content}
                                                </div>
                                                <button onClick={() => setReplyingTo(null)} className="ml-2 text-[#D95A6F] hover:text-white">✕</button>
                                            </div>
                                        )}
                                        <form className="flex gap-2" onSubmit={handleSendMessage}>
                                            <input
                                                name="msg"
                                                value={messageDraft}
                                                onChange={handleMessageInputChange}
                                                className="flex-1 border border-[#3E3563] bg-[#120E29] px-4 py-3 text-sm text-[#E9E4FA] outline-none placeholder:text-[#8178A5] focus:border-[#6E62A3]"
                                                placeholder={
                                                    activeChat.type === "direct" && relationshipStatus === "NONE"
                                                        ? "Send a message to start a conversation..."
                                                        : "Transmit message..."
                                                }
                                            />
                                            <button
                                                disabled={isSending || (activeChat.type === "direct" && relationshipStatus === "PENDING")}
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
                                <form className="flex items-start justify-between" onSubmit={handleSearchID}>
                                    <div>
                                        <h1 className="text-5xl font-bold leading-none tracking-[0.02em] text-[#F6F2FF]">CHATRIX</h1>
                                        <p className="mt-1 text-[10px] tracking-[0.3em] text-[#958BB8] uppercase">STUDIO v1.0</p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!searchQuery || isSearching}
                                        className="inline-flex h-8 w-8 items-center justify-center border border-[#463D6A] bg-[#1A1434] text-[#D4CCEE] transition hover:bg-[#241C46] disabled:cursor-not-allowed disabled:opacity-50"
                                        title="Search user by ID or name"
                                    >
                                        ⌕
                                    </button>
                                </form>

                                <form className="mt-6 max-w-md" onSubmit={handleSearchID}>
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => {
                                            const target = e.currentTarget as unknown as { value: string };
                                            setSearchQuery(target.value);
                                        }}
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
                    <div className="fixed inset-0 z-50 grid place-items-center bg-[#05040D]/80 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md border border-[#2B2448] bg-[rgba(14,10,33,0.95)] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.68)]">
                            <h3 className="text-lg font-semibold tracking-[0.08em] text-[#F1EDFF]">Create New Room</h3>
                            <p className="mt-1 text-xs tracking-[0.14em] text-[#A79FC8] uppercase">Give your room a clear, short name.</p>

                            <form className="mt-4 space-y-3" onSubmit={handleCreateRoom}>
                                <input
                                    value={newRoomName}
                                    onChange={(e) => {
                                        const target = e.currentTarget as unknown as { value: string };
                                        setNewRoomName(target.value);
                                    }}
                                    placeholder="e.g. design-ops"
                                    className="w-full border border-[#3E3563] bg-[#120E29] px-3 py-2 text-sm text-[#E9E4FA] outline-none placeholder:text-[#8178A5] focus:border-[#6E62A3]"
                                />

                                {createRoomError && (
                                    <p className="text-sm text-rose-400">{createRoomError}</p>
                                )}

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateRoomModal(false)}
                                        className="border border-[#3A335A] px-3 py-2 text-sm text-[#B8B0DA] hover:bg-[#15112B]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreatingRoom}
                                        className="border border-[#554A80] bg-[#251E42] px-3 py-2 text-sm font-bold text-[#F4F0FF] hover:bg-[#32275A] disabled:opacity-70"
                                    >
                                        {isCreatingRoom ? "Creating..." : "Create Room"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {selectedProfileUser && (
                    <div className="fixed inset-0 z-50 grid place-items-center bg-[#05040D]/80 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md border border-[#2B2448] bg-[rgba(14,10,33,0.95)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.68)]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold tracking-[0.04em] text-[#F1EDFF]">{selectedProfileUser.name || "User Profile"}</h3>
                                <button onClick={() => setSelectedProfileUser(null)} className="text-[#6E62A3] hover:text-white">✕</button>
                            </div>
                            <p className="mt-1 text-xs tracking-[0.14em] text-[#A79FC8] uppercase">{selectedProfileUser.email}</p>

                            {(requestActionError || requestActionInfo) && (
                                <div className={`mt-4 rounded border p-3 text-[10px] font-bold uppercase tracking-widest ${requestActionError ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"}`}>
                                    {requestActionError || requestActionInfo}
                                </div>
                            )}

                            <div className="mt-8 space-y-4">
                                <div className="rounded border border-[#2B2450] bg-black/20 p-4">
                                    <p className="text-[10px] font-bold text-[#8D83B2] uppercase tracking-[0.2em] mb-2">User ID</p>
                                    <p className="text-xs font-mono text-[#D6D0EF] break-all">{selectedProfileUser.id}</p>
                                </div>

                                {selectedProfileUser.id !== currentUserId && (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => {
                                                setActiveChat({ id: selectedProfileUser.id, type: "direct" });
                                                setSelectedProfileUser(null);
                                                setSidebarMode(null);
                                            }}
                                            className="w-full border border-[#554A80] bg-[#251E42] py-3 text-xs font-bold tracking-[0.2em] text-[#F4F0FF] uppercase hover:bg-[#32275A]"
                                        >
                                            Message
                                        </button>

                                        <div className="pt-4 border-t border-[#2B2450]">
                                            <h4 className="text-[10px] font-bold text-[#8D83B2] uppercase tracking-widest mb-3">Invite to your Rooms</h4>
                                            <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                                                {data.rooms.filter(r => r.creatorId === currentUserId).length === 0 && (
                                                    <p className="text-[10px] text-[#6E62A3]">You don't own any rooms yet.</p>
                                                )}
                                                {data.rooms.filter(r => r.creatorId === currentUserId).map(r => (
                                                    <div key={r.id} className="flex items-center justify-between rounded bg-black/30 p-2">
                                                        <span className="text-[10px] text-[#D6D0EF]"># {r.name}</span>
                                                        <button
                                                            onClick={() => handleInviteToRoom(r.id, selectedProfileUser.id)}
                                                            className="text-[9px] font-bold text-[#A298C3] uppercase hover:text-emerald-400"
                                                        >
                                                            INVITE
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* RIGHT SIDEBAR: NOTIFICATION PANEL */}
                <div
                    className={`fixed right-0 top-0 z-50 h-full border-l border-[#24203B] bg-[rgba(8,6,20,0.95)] backdrop-blur-2xl transition-all duration-500 overflow-hidden shadow-[-20px_0_50px_rgba(0,0,0,0.5)] ${showNotifications ? "w-96" : "w-0"}`}
                >
                    <div className="flex h-full flex-col p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-bold tracking-[0.25em] text-[#D9D2F1] uppercase">Notifications</h3>
                            <button onClick={() => setShowNotifications(false)} className="text-[#6E62A3] hover:text-[#F1EDFF] transition">✕</button>
                        </div>

                        <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                            {/* ROOM ACTIVITY SECTION */}
                            {(roomJoinRequests.length > 0 || roomInvites.length > 0) && (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold tracking-widest text-[#6E62A3] uppercase">Room Activity</p>
                                    {roomJoinRequests.map((r) => (
                                        <div key={r.id} className="rounded-xl border border-[#2B2450] bg-[#0F0C21]/50 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1534] text-[10px] font-bold text-violet-400">
                                                    {getAvatarToken(r.user_name)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-semibold text-[#D6D0EF]">{r.user_name || "New User"}</p>
                                                    <p className="mt-0.5 text-[10px] text-[#8D83B2]">Join request: <span className="text-violet-300">#{r.roomId.slice(0, 8)}</span></p>
                                                    <div className="mt-3 flex gap-2">
                                                        <button onClick={() => handleRespondJoinRoom(r.id, 'accept')} className="flex-1 rounded-md bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20">Accept</button>
                                                        <button onClick={() => handleRespondJoinRoom(r.id, 'reject')} className="flex-1 rounded-md bg-rose-500/10 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20">Decline</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {roomInvites.map((i) => (
                                        <div key={i.id} className="rounded-xl border border-[#2B2450] bg-[#0F0C21]/50 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2A2248] text-sm">✉</div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-semibold text-[#D6D0EF]">Join #{i.room_name}</p>
                                                    <p className="mt-0.5 text-[10px] text-[#8D83B2]">Invite from {i.from_user_name}</p>
                                                    <div className="mt-3 flex gap-2">
                                                        <button onClick={() => handleRespondRoomInvite(i.id, 'accept')} className="flex-1 rounded-md bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20">Join</button>
                                                        <button onClick={() => handleRespondRoomInvite(i.id, 'reject')} className="flex-1 rounded-md bg-rose-500/10 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20">Ignore</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* FRIEND REQUESTS SECTION */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-bold tracking-widest text-[#6E62A3] uppercase">Friend Requests</p>
                                {friendRequestsIncoming.length === 0 && <p className="text-[10px] text-[#4A4273] italic">No pending requests</p>}
                                {friendRequestsIncoming.map((r) => (
                                    <div key={r.id} className="rounded-xl border border-[#2B2450] bg-[#0F0C21]/50 p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1534] text-[11px] font-bold text-violet-400">
                                                {getAvatarToken(r.from_user_name)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-[#D6D0EF]">{r.from_user_name}</p>
                                                <div className="mt-2 flex gap-2">
                                                    <button onClick={() => runRequestAction(`f-accept-${r.id}`, () => fetch(`${API_BASE}/api/friend-requests/accept`, { method: "POST", headers: authHeaders(getBearerToken()!), body: JSON.stringify({ requestId: r.id }) }), "Accepted!")} className="flex-1 rounded-md bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20">Accept</button>
                                                    <button onClick={() => runRequestAction(`f-reject-${r.id}`, () => fetch(`${API_BASE}/api/friend-requests/reject`, { method: "POST", headers: authHeaders(getBearerToken()!), body: JSON.stringify({ requestId: r.id }) }), "Reject")} className="flex-1 rounded-md bg-rose-500/10 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20">Reject</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* FRIENDS LIST SECTION (Simplified) */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-bold tracking-widest text-[#6E62A3] uppercase">Friends Online</p>
                                <div className="space-y-2">
                                    {friends.filter(f => onlineUsers.has(f.id)).map((f) => (
                                        <div key={f.id} className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs text-[#B8B0DA]">{f.name || f.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>



    );
};



export default DashboardPage;

