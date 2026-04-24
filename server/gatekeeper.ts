export async function gatekeeper(db: any, userA: string, userB: string) {
    const [id1, id2] = [userA, userB].sort();
    // check for friendship
    const friendship = db.query(
        `SELECT * FROM friendship WHERE (user_a_id =?) OR (user_b_id = ?)`,
    ).get(id1, id2);

    if (friendship) return "ACCEPTED";

    const request = db.query(
        `SELECT * FROM message_request WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
    ).get(userA, userB);

    return request ? request.status.toUpperCase() : "NONE";
}