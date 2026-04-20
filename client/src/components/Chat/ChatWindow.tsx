import { useEffect, useState } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

type ChatMessage = {
    id: string | number;
    senderId: string;
    text: string;
};

export default function ChatWindow({ activeChat }: { activeChat: any }): import("react/jsx-runtime").JSX.Element {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState("");
    const { sendMessage } = useChatSocket();

    // 1. Fetch History when activeChat changes
    useEffect(() => {
        if (!activeChat.id) return;

        const url = activeChat.type === 'room'
            ? `http://localhost:3000/api/rooms/${activeChat.id}/messages`
            : `http://localhost:3000/api/messages/${activeChat.id}`;

        fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
            .then(res => res.json())
            .then(setMessages);
    }, [activeChat]);

    // 2. Send Message
    const handleSend = () => {
        const payload = {
            type: activeChat.type === 'room' ? 'room_message' : 'chat-message',
            [activeChat.type === 'room' ? 'roomId' : 'receiverId']: activeChat.id,
            text: text
        };
        sendMessage(payload);
        setText("");
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900">
            {/* Messages Area */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                    <div key={m.id} className={`p-2 rounded max-w-xs ${m.senderId === 'me' ? 'bg-indigo-600 ml-auto' : 'bg-zinc-700'}`}>
                        {m.text}
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-800 flex">
                <input
                    className="flex-grow bg-zinc-800 p-2 text-white outline-none"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button onClick={handleSend} className="ml-2 bg-indigo-500 px-4 py-2 text-white">Send</button>
            </div>
        </div>
    );
}