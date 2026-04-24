import db from "../db/connection";

export type MessageContentType = "text" | "file";

export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string | null;
    roomId: string | null;
    text: string;
    contentType: MessageContentType;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    status: "sent" | "delivered" | "read";
    timestamp: string;
    deliveredAt: string | null;
    readAt: string | null;
    aiSource: string | null;
}

export const messageRepo = {
    savePrivateMessage: (senderId: string,
        receiverId: string,
        text: string,
        options?: {
            contentType?: MessageContentType;
            fileUrl?: string | null;
            fileName?: string | null;
            fileSize?: number | null;
            aiSource?: string | null;
        },): ChatMessage => {

        // 1. 🚨 DEBUG TRACKER: Let's see exactly what values are making it to this function!
        console.log("🛠️ DEBUG - Variables about to be saved:", { senderId, receiverId, text });

        // 2. Safety check: If text is lost, stop right here and tell us!
        if (text === undefined || text === null) {
            throw new Error("CRITICAL BUG: The text variable is null before hitting the database!");
        }

        const id = crypto.randomUUID();
        const timestamp = new Date();
        const status: ChatMessage["status"] = "sent";
        const contentType = options?.contentType || "text";
        const fileUrl = options?.fileUrl || null;
        const fileName = options?.fileName || null;
        const fileSize = options?.fileSize || null;
        const aiSource = options?.aiSource || null;

        try {
            // 3. Wrapping "text" in quotes to prevent SQLite from thinking it's a command.
            // 4. Using 7 explicit positional question marks to prevent any alignment bugs.

            db.query(`
            INSERT INTO messages
                (id, senderId, receiverId, roomId, text, contentType, fileUrl, fileName, fileSize, status, timestamp, deliveredAt, readAt, aiSource)
            VALUES
                (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
        `).run(
                id,
                senderId,
                receiverId,
                text,
                contentType,
                fileUrl,
                fileName,
                fileSize,
                status,
                timestamp.toISOString(),
                aiSource,
            );

            return {
                id,
                senderId,
                receiverId,
                roomId: null,
                text,
                contentType,
                fileUrl,
                fileName,
                fileSize,
                status,
                timestamp: timestamp.toISOString(),
                deliveredAt: null,
                readAt: null,
                aiSource,
            };
        } catch (error) {
            console.error("❌ DB Save Error:", error);
            throw error;
        }
    },
    getConversation: (userId: string, otherUserId: string): ChatMessage[] => {
        return db.query(`
            SELECT
                id, senderId, receiverId, roomId, text, contentType, fileUrl, fileName, fileSize,
                status, timestamp, deliveredAt, readAt, aiSource
            FROM messages
            WHERE
                (senderId = $userId AND receiverId = $otherUserId)
                OR
                (senderId = $otherUserId AND receiverId = $userId)
            ORDER BY timestamp ASC
        `).all({
            $userId: userId,
            $otherUserId: otherUserId,
        }) as ChatMessage[];
    },

    markconversationAsDelivered: (userId: string, otherUserId: string): number => {
        const now = new Date().toISOString();
        const result = db.query(`
            UPDATE messages
            SET status = 'delivered', deliveredAt = COALESCE(deliveredAt, $now)
            WHERE
                receiverId = $recipientId AND senderId = $otherUserId AND status = 'sent'
        `).run({
            $now: now,
            $recipientId: userId,
            $otherUserId: otherUserId
        });
        return result.changes;
    },

    markconversationAsRead: (userId: string, otherUserId: string): number => {
        const now = new Date().toISOString();
        const result = db.query(`
            UPDATE messages
            SET status = 'read', readAt = COALESCE(readAt, $now)
            WHERE
                receiverId = $recipientId AND senderId = $otherUserId AND status IN ('sent', 'delivered')
        `).run({
            $now: now,
            $recipientId: userId,
            $otherUserId: otherUserId
        });
        return result.changes;
    }
};

