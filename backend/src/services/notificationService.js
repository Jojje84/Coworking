function getIoFromReq(req) {
  return req?.app?.get?.("io") || null;
}

function toPlain(value) {
  if (!value) return value;
  return typeof value.toObject === "function" ? value.toObject() : value;
}

function getPayloadUserId(payload) {
  if (!payload?.userId) return null;

  if (typeof payload.userId === "object") {
    return (
      payload.userId._id?.toString?.() ||
      payload.userId.id?.toString?.() ||
      null
    );
  }

  return payload.userId.toString();
}

export function emitBookingEvent(req, event, payload) {
  const io = getIoFromReq(req);
  if (!io || !payload) return;

  const plain = toPlain(payload);
  const ownerId = getPayloadUserId(plain);

  if (ownerId) {
    io.to(ownerId).emit(event, plain);
  }

  io.to("admins").emit(event, plain);
}

export function emitCalendarChanged(req) {
  const io = getIoFromReq(req);
  if (!io) return;

  io.emit("calendar:changed", {
    updatedAt: new Date().toISOString(),
  });
}

export function emitUserEvent(req, eventName, payload) {
  const io = getIoFromReq(req);
  if (!io || !payload) return;

  if (payload?.id) {
    io.to(payload.id).emit(eventName, payload);
  }

  io.to("admins").emit(eventName, payload);
}

export function emitRoomEvent(req, eventName, payload) {
  const io = getIoFromReq(req);
  if (!io || !payload) return;

  io.emit(eventName, payload);
}
