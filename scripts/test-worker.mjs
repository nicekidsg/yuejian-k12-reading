import assert from "node:assert/strict";
import worker from "../worker/index.js";

class FakeStatement {
  constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { return this.database.run(this.sql, this.values); }
  async first() { return this.database.first(this.sql, this.values); }
  async all() { return this.database.all(this.sql, this.values); }
}

class FakeDatabase {
  profiles = new Map();
  friendships = new Set();
  prepare(sql) { return new FakeStatement(this, sql); }
  async run(sql, values) {
    if (sql.startsWith("INSERT INTO reader_profiles")) {
      const [id, friendCode, secretHash, nickname, now] = values;
      if ([...this.profiles.values()].some((profile) => profile.friend_code === friendCode)) throw new Error("duplicate");
      this.profiles.set(id, { id, friend_code: friendCode, secret_hash: secretHash, nickname, completed_count: 0, started_count: 0, total_progress: 0, progress_json: "{}", created_at: now, updated_at: now });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE reader_profiles")) {
      const [nickname, completed, started, total, progressJson, now, id] = values;
      Object.assign(this.profiles.get(id), { nickname, completed_count: completed, started_count: started, total_progress: total, progress_json: progressJson, updated_at: now });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT OR IGNORE INTO reader_friendships")) {
      this.friendships.add(`${values[0]}:${values[1]}`);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM reader_friendships")) {
      const friend = [...this.profiles.values()].find((profile) => profile.friend_code === values[1]);
      if (friend) this.friendships.delete(`${values[0]}:${friend.id}`);
      return { meta: { changes: friend ? 1 : 0 } };
    }
    throw new Error(`Unsupported run query: ${sql}`);
  }
  async first(sql, values) {
    if (sql.includes("WHERE id = ?1 AND secret_hash = ?2")) {
      const profile = this.profiles.get(values[0]);
      return profile?.secret_hash === values[1] ? { id: profile.id, friend_code: profile.friend_code, nickname: profile.nickname } : null;
    }
    if (sql.includes("WHERE friend_code = ?1")) {
      return [...this.profiles.values()].find((profile) => profile.friend_code === values[0]) || null;
    }
    throw new Error(`Unsupported first query: ${sql}`);
  }
  async all(sql, values) {
    if (!sql.includes("FROM reader_friendships")) throw new Error(`Unsupported all query: ${sql}`);
    const prefix = `${values[0]}:`;
    const results = [...this.friendships].filter((item) => item.startsWith(prefix)).map((item) => this.profiles.get(item.slice(prefix.length)));
    return { results };
  }
}

const database = new FakeDatabase();
const assets = { fetch: async (request) => new URL(request.url).pathname === "/index.html" ? new Response("app") : new Response("missing", { status: 404 }) };
const env = { DB: database, ASSETS: assets };

async function request(path, options = {}) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, options), env);
  const payload = response.headers.get("Content-Type")?.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

const first = await request("/api/friends/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: "小海豚" }) });
const second = await request("/api/friends/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: "小星星" }) });
assert.equal(first.response.status, 201);
assert.match(first.payload.identity.friendCode, /^YJ-[A-Z2-9]{6}$/);

const firstIdentity = first.payload.identity;
const secondIdentity = second.payload.identity;
const auth = { "Content-Type": "application/json", Authorization: `Bearer ${firstIdentity.secret}` };
const update = await request("/api/friends/profile", { method: "PUT", headers: auth, body: JSON.stringify({ id: firstIdentity.id, nickname: "小海豚", progress: { completedCount: 3, startedCount: 4, totalProgress: 62, categoryCounts: { fantasy: 2 }, lastBookTitle: "Alice" } }) });
assert.equal(update.payload.profile.completedCount, 3);

const add = await request("/api/friends", { method: "POST", headers: auth, body: JSON.stringify({ ownerId: firstIdentity.id, friendCode: secondIdentity.friendCode }) });
assert.equal(add.response.status, 201);
assert.equal(add.payload.friend.nickname, "小星星");

const list = await request(`/api/friends?ownerId=${firstIdentity.id}`, { headers: { Authorization: `Bearer ${firstIdentity.secret}` } });
assert.equal(list.payload.friends.length, 1);
assert.equal(list.payload.friends[0].friendCode, secondIdentity.friendCode);

const fallback = await request("/some-client-route");
assert.equal(fallback.response.status, 200);
assert.equal(fallback.payload, "app");

console.log("worker tests passed: profile auth, progress update, friend add/list, SPA fallback");
