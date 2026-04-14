import db from "../db/connection";

export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    roomId: string | null;
    text: string;
    status: string;
    timestamp: Date;
}

export const messageRepo = {
    savePrivateMessage: (senderId: string, receiverId: string, text: string): ChatMessage => {
        const id = crypto.randomUUID();
        const timestamp = new Date();
        const status = "sent";
        db.query(
            `INSERT INTO  messages (id, senderId, receiverId, text, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(id, senderId, receiverId, text, status, timestamp.toISOString());
        return { id, senderId, receiverId, roomId: null, text, status, timestamp };
    }
};