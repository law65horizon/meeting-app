const mediasoup = require("mediasoup");
const config = require("../config");
const Room = require("./room");
const {getRoomDoc} = require('../firebase/utils')

const rooms = new Map();

async function getOrCreateRoom(worker, roomId, user) {
  const roomDoc = await getRoomDoc(roomId)
  if (!roomDoc) throw new Error('Room doc not found')
  if (roomDoc.isPrivate && ![roomDoc.hostId, ...roomDoc.recipients].includes(user?.user_id)) throw new Error('Not authorized')
  if (roomDoc.passcode != user?.passcode) throw new Error('Not authorized')
  
  if (rooms.has(roomId)) return rooms.get(roomId);

  //create server room
  if (!user) throw new Error('Not authenticated')
  if (roomDoc.hostId !== user.user_id) throw new Error('Not authorized')
  const router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
 
  const room = new Room(router, {
    private: roomDoc.isPrivate,
    host: roomDoc.hostId,
    passcode: roomDoc.passcode
  });
  
  rooms.set(roomId, room)

  console.log(`Room ${roomId} created, router ${router.id}`);
  return room;
}

function getRoom(roomId) {
    return rooms.get(roomId)
}

function deleteRoom(roomId) {
    const room = rooms.get(roomId)
    if (room) {
        room.router.close()
        rooms.delete(roomId)
        console.log(`room ${roomId} deleted`)
    }
}

module.exports = {
    getOrCreateRoom,
    getRoom,
    deleteRoom
}