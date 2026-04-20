import { useEffect, useRef, useState } from "react";
import { authClient } from "../api/auth";

export function useChatSocket() {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [latestMessage, setLatestMessage] = useState(null);

    useEffect(() => {
        // 1. Get the session token to authenticate the WS
        const connect = async () => {
            const session = await authClient.getSession();
            if (!session) return;

            // Connect to your Bun backend with the token in the query
            // Or use the Authorization header if your WS client supports it
            const ws = new WebSocket(`ws://localhost:3000/chat?token=${session.data?.session.token}`);

            ws.onopen = () => setIsConnected(true);
            ws.onclose = () => setIsConnected(false);
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log("New Message:", data);
                // We will add logic here to update React state
                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    setLatestMessage(data); // This triggers a re-render in the component
                };

                return { sendMessage, isConnected, latestMessage };

            };

            setSocket(ws);
        };

        connect();
    }, []);

    const sendMessage = (payload: any) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        }
    };

    return { sendMessage, isConnected };
}