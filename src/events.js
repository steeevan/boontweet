// ===========================================================================
// events.js — in-memory registry of open Server-Sent-Events connections.
// ===========================================================================
// Lets the rest of the app push live updates to connected browsers:
//   - emitToUser(id, ...)  → one user's tabs (e.g. a new notification)
//   - emitAll(...)         → everyone (e.g. "a new tweet was posted")
// In-memory means this works for a single instance (fine for our one Render
// service); a multi-instance deploy would need a shared pub/sub (e.g. Redis).
// ===========================================================================

const userClients = new Map(); // userId -> Set<res>
const allClients = new Set();  // every open connection

function addClient(userId, res) {
  allClients.add(res);
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  userClients.get(userId).add(res);
}

function removeClient(userId, res) {
  allClients.delete(res);
  const set = userClients.get(userId);
  if (set) { set.delete(res); if (!set.size) userClients.delete(userId); }
}

function send(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { /* dead connection */ }
}

function emitToUser(userId, event, data) {
  const set = userClients.get(userId);
  if (set) for (const res of set) send(res, event, data);
}

function emitAll(event, data) {
  for (const res of allClients) send(res, event, data);
}

module.exports = { addClient, removeClient, emitToUser, emitAll };
