import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { createApp } from "../src/app.js";
import { Room } from "../src/models/Room.js";
import { User } from "../src/models/User.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const app = createApp();
let mongoServer;
let integrationReady = true;
let integrationSkipReason = "";

async function registerAndLogin() {
  const registerRes = await request(app).post("/api/auth/register").send({
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@example.com`,
    password: "secret123",
  });

  assert.equal(registerRes.status, 201);

  const loginRes = await request(app).post("/api/auth/login").send({
    email: registerRes.body.email,
    password: "secret123",
  });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);

  return loginRes.body.token;
}

async function registerUser(emailPrefix) {
  const registerRes = await request(app).post("/api/auth/register").send({
    username: `${emailPrefix}_${Date.now()}`,
    email: `${emailPrefix}_${Date.now()}@example.com`,
    password: "secret123",
  });

  assert.equal(registerRes.status, 201);
  return registerRes.body;
}

async function loginWithEmail(email) {
  const loginRes = await request(app).post("/api/auth/login").send({
    email,
    password: "secret123",
  });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
  return loginRes.body.token;
}

test.before(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  } catch (err) {
    integrationReady = false;
    integrationSkipReason =
      err?.message || "mongodb-memory-server is unavailable";
  }
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.afterEach(async () => {
  if (!integrationReady || mongoose.connection.readyState === 0) {
    return;
  }

  const collections = mongoose.connection.collections;

  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

test("auth register + login returns token", async (t) => {
  if (!integrationReady) {
    t.skip(integrationSkipReason);
    return;
  }

  const res = await request(app).post("/api/auth/register").send({
    username: "anna",
    email: "anna@example.com",
    password: "secret123",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.email, "anna@example.com");

  const login = await request(app).post("/api/auth/login").send({
    email: "anna@example.com",
    password: "secret123",
  });

  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  assert.equal(login.body.user.email, "anna@example.com");
});

test("booking create requires auth and creates booking for user", async (t) => {
  if (!integrationReady) {
    t.skip(integrationSkipReason);
    return;
  }

  const token = await registerAndLogin();

  const room = await Room.create({
    name: "Integration Room",
    capacity: 4,
    type: "workspace",
    description: "",
    imageUrl: "",
  });

  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const unauthRes = await request(app).post("/api/bookings").send({
    roomId: room._id.toString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });

  assert.equal(unauthRes.status, 401);

  const authRes = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      roomId: room._id.toString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

  assert.equal(authRes.status, 201);
  assert.equal(authRes.body.roomId._id, room._id.toString());
  assert.equal(authRes.body.status, "active");
});

test("booking owner can update and delete own booking", async (t) => {
  if (!integrationReady) {
    t.skip(integrationSkipReason);
    return;
  }

  const token = await registerAndLogin();

  const room = await Room.create({
    name: "Owner Room",
    capacity: 6,
    type: "workspace",
    description: "",
    imageUrl: "",
  });

  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const createRes = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send({
      roomId: room._id.toString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

  assert.equal(createRes.status, 201);

  const bookingId = createRes.body._id;
  const updatedEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

  const updateRes = await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ endTime: updatedEnd });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body._id, bookingId);
  assert.equal(new Date(updateRes.body.endTime).toISOString(), updatedEnd);

  const deleteRes = await request(app)
    .delete(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${token}`);

  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.ok, true);
});

test("non-owner cannot delete another users booking", async (t) => {
  if (!integrationReady) {
    t.skip(integrationSkipReason);
    return;
  }

  const owner = await registerUser("owner");
  const ownerToken = await loginWithEmail(owner.email);

  const other = await registerUser("other");
  const otherToken = await loginWithEmail(other.email);

  const room = await Room.create({
    name: "Shared Room",
    capacity: 8,
    type: "conference",
    description: "",
    imageUrl: "",
  });

  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const createRes = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      roomId: room._id.toString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

  assert.equal(createRes.status, 201);

  const forbiddenDelete = await request(app)
    .delete(`/api/bookings/${createRes.body._id}`)
    .set("Authorization", `Bearer ${otherToken}`);

  assert.equal(forbiddenDelete.status, 403);
});

test("admin can list users while normal user gets 403", async (t) => {
  if (!integrationReady) {
    t.skip(integrationSkipReason);
    return;
  }

  const regular = await registerUser("regular");
  const regularToken = await loginWithEmail(regular.email);

  const admin = await registerUser("admin");
  await User.findOneAndUpdate({ email: admin.email }, { role: "Admin" });
  const adminToken = await loginWithEmail(admin.email);

  const regularUsersRes = await request(app)
    .get("/api/users")
    .set("Authorization", `Bearer ${regularToken}`);
  assert.equal(regularUsersRes.status, 403);

  const adminUsersRes = await request(app)
    .get("/api/users")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminUsersRes.status, 200);
  assert.ok(Array.isArray(adminUsersRes.body));
  assert.ok(adminUsersRes.body.length >= 2);
});
