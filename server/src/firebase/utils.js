const admin = require('./index')

async function getRoomDoc(roomId) {
    if (!roomId) {
       console.error("No roomId provided to closeRoom");
       return;
    }
    const db = admin.firestore()

    const docSnap = await db.collection("meetings").doc(roomId).get()

    if(!docSnap.exists) return null
    return docSnap.data()
}

async function closeRoom(roomId) {
    if (!roomId) {
        console.error("No roomId provided to closeRoom");
        return;
    }
    const db = admin.firestore();

    try {
        await db.collection("meetings").doc(roomId).update({
            status: "closed"
        });
        console.log(`Room ${roomId} status updated to closed.`);
    } catch (error) {
        console.error("Error updating room status:", error);
    }
}


module.exports = {getRoomDoc, closeRoom}