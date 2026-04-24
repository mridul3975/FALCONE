import db from "../db/connection";

export const roomRepo = {
    // 1. Create a new room
    createRoom: (name: string) => {
        const id = crypto.randomUUID();
        try {
            db.query(`INSERT INTO rooms (id, name) VALUES ($id, $name)`).run({
                $id: id,
                $name: name
            });
            console.log(`🏠 Created new room: ${name}`);
            return { id, name };
        } catch (error) {
            console.error("❌ Error creating room:", error);
            throw error;
        }
    },

    // 2. Get a list of all rooms
    getAllRooms: () => {
        return db.query(`SELECT * FROM rooms ORDER BY createdAt DESC`).all();
    },

    // 3. Save a message sent to a room
    saveRoomMessage: (senderId: string, roomId: string, text: string) => {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const status = "sent";

        try {
            db.query(`
                INSERT INTO messages (id, senderId, receiverId, roomId, "text", status, timestamp)
                VALUES ($id, $senderId, NULL, $roomId, $text, $status, $timestamp)
            `).run({
                $id: id,
                $senderId: senderId,
                $roomId: roomId, // Notice how receiverId is NULL, but roomId is set!
                $text: text,
                $status: status,
                $timestamp: timestamp
            });
        } catch (error) {
            console.error("❌ Error saving room message:", error);
            throw error;
        }

        return { id, senderId, receiverId: null, roomId, text, status, timestamp };
    }
};

export function getRoomMessages(roomId: string, limit = 100) {
    try {
        const query = db.query(`
            SELECT 
                m.id, m.senderId, m.roomId, m.text, m.status, m.timestamp
            FROM messages m
            WHERE m.roomId = $roomId
            ORDER BY m.timestamp ASC
            LIMIT $limit
        `);
        return query.all({ $roomId: roomId, $limit: limit });
    } catch (error) {
        console.error("❌ Error fetching room messages:", error);
        throw error;
    }
}
