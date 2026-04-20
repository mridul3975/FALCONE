import { useState } from "react";
import Sidebar from "../components/Chat/Sidebar";
import ChatWindow from "../components/Chat/ChatWindow";

export default function DashboardPage() {
    // activeChat tracks WHICH room or user we are talking to
    const [activeChat, setActiveChat] = useState<{ id: string | null; type: 'direct' | 'room' | null }>({ id: null, type: null });

    return (
        <div className="flex h-screen bg-zinc-900 text-zinc-100">
            {/* 1. Sidebar: Passes the function to update activeChat */}
            <Sidebar onSelect={(id: string, type: 'direct' | 'room') => setActiveChat({ id, type })} />

            {/* 2. Chat Window: Displays content based on selection */}
            <div className="flex-grow">
                {activeChat.id ? (
                    <ChatWindow activeChat={activeChat} />
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        Select a conversation to start messaging.
                    </div>
                )}
            </div>
        </div>
    );
}