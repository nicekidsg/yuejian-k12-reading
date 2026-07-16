const FRIEND_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CATEGORY_IDS = ["fantasy", "adventure", "animals", "growth", "world"];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : minimum;
}

function randomToken(length = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomFriendCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `YJ-${Array.from(bytes, (byte) => FRIEND_CODE_ALPHABET[byte % FRIEND_CODE_ALPHABET.length]).join("")}`;
}

async function hashSecret(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bearerSecret(request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function requestBody(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 12_000) throw new Response("提交内容过长。", { status: 413 });
  try {
    return await request.json();
  } catch {
    throw new Response("提交格式无效。", { status: 400 });
  }
}

function publicProfile(row) {
  let progress = {};
  try {
    progress = JSON.parse(row.progress_json || "{}");
  } catch {
    progress = {};
  }
  return {
    friendCode: row.friend_code,
    nickname: row.nickname,
    completedCount: row.completed_count || 0,
    startedCount: row.started_count || 0,
    totalProgress: row.total_progress || 0,
    categoryCounts: progress.categoryCounts || {},
    lastBookTitle: progress.lastBookTitle || "",
    updatedAt: row.updated_at,
  };
}

async function authorizedProfile(request, env, id) {
  const secret = bearerSecret(request);
  if (!id || !secret) return null;
  const secretHash = await hashSecret(secret);
  return env.DB.prepare(
    "SELECT id, friend_code, nickname FROM reader_profiles WHERE id = ?1 AND secret_hash = ?2 LIMIT 1",
  ).bind(id, secretHash).first();
}

async function createProfile(request, env) {
  const body = await requestBody(request);
  const nickname = cleanText(body.nickname, 20) || "小读者";
  const id = crypto.randomUUID();
  const secret = randomToken();
  const secretHash = await hashSecret(secret);
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const friendCode = randomFriendCode();
    try {
      await env.DB.prepare(
        "INSERT INTO reader_profiles (id, friend_code, secret_hash, nickname, completed_count, started_count, total_progress, progress_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 0, 0, 0, '{}', ?5, ?5)",
      ).bind(id, friendCode, secretHash, nickname, now).run();
      return jsonResponse({ identity: { id, friendCode, secret, nickname } }, 201);
    } catch (error) {
      if (attempt === 5) throw error;
    }
  }
  return jsonResponse({ error: "好友码创建失败。" }, 500);
}

function sanitizeProgress(progress) {
  const categoryCounts = Object.fromEntries(CATEGORY_IDS.map((id) => [
    id,
    clampNumber(progress?.categoryCounts?.[id], 0, 20),
  ]));
  return {
    completedCount: clampNumber(progress?.completedCount, 0, 100),
    startedCount: clampNumber(progress?.startedCount, 0, 100),
    totalProgress: clampNumber(progress?.totalProgress, 0, 100),
    categoryCounts,
    lastBookTitle: cleanText(progress?.lastBookTitle, 120),
  };
}

async function updateProfile(request, env) {
  const body = await requestBody(request);
  const owner = await authorizedProfile(request, env, cleanText(body.id, 80));
  if (!owner) return jsonResponse({ error: "身份验证失败，请在创建好友码的设备上重试。" }, 401);
  const nickname = cleanText(body.nickname, 20) || owner.nickname;
  const progress = sanitizeProgress(body.progress || {});
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE reader_profiles SET nickname = ?1, completed_count = ?2, started_count = ?3, total_progress = ?4, progress_json = ?5, updated_at = ?6 WHERE id = ?7",
  ).bind(nickname, progress.completedCount, progress.startedCount, progress.totalProgress, JSON.stringify(progress), now, owner.id).run();
  return jsonResponse({ profile: { friendCode: owner.friend_code, nickname, ...progress, updatedAt: now } });
}

async function listFriends(request, env, url) {
  const ownerId = cleanText(url.searchParams.get("ownerId"), 80);
  const owner = await authorizedProfile(request, env, ownerId);
  if (!owner) return jsonResponse({ error: "身份验证失败。" }, 401);
  const result = await env.DB.prepare(
    "SELECT p.friend_code, p.nickname, p.completed_count, p.started_count, p.total_progress, p.progress_json, p.updated_at FROM reader_friendships f JOIN reader_profiles p ON p.id = f.friend_id WHERE f.owner_id = ?1 ORDER BY p.updated_at DESC",
  ).bind(ownerId).all();
  return jsonResponse({ friends: (result.results || []).map(publicProfile) });
}

async function addFriend(request, env) {
  const body = await requestBody(request);
  const ownerId = cleanText(body.ownerId, 80);
  const owner = await authorizedProfile(request, env, ownerId);
  if (!owner) return jsonResponse({ error: "身份验证失败。" }, 401);
  const friendCode = cleanText(body.friendCode, 12).toUpperCase();
  const friend = await env.DB.prepare(
    "SELECT id, friend_code, nickname, completed_count, started_count, total_progress, progress_json, updated_at FROM reader_profiles WHERE friend_code = ?1 LIMIT 1",
  ).bind(friendCode).first();
  if (!friend) return jsonResponse({ error: "没有找到这个好友码。" }, 404);
  if (friend.id === ownerId) return jsonResponse({ error: "不能添加自己。" }, 400);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO reader_friendships (owner_id, friend_id, created_at) VALUES (?1, ?2, ?3)",
  ).bind(ownerId, friend.id, new Date().toISOString()).run();
  return jsonResponse({ friend: publicProfile(friend) }, 201);
}

async function removeFriend(request, env, url, friendCode) {
  const ownerId = cleanText(url.searchParams.get("ownerId"), 80);
  const owner = await authorizedProfile(request, env, ownerId);
  if (!owner) return jsonResponse({ error: "身份验证失败。" }, 401);
  await env.DB.prepare(
    "DELETE FROM reader_friendships WHERE owner_id = ?1 AND friend_id = (SELECT id FROM reader_profiles WHERE friend_code = ?2)",
  ).bind(ownerId, friendCode.toUpperCase()).run();
  return jsonResponse({ removed: true });
}

async function handleFriendsApi(request, env, url) {
  if (!env.DB) return jsonResponse({ error: "好友服务正在准备中。" }, 503);
  try {
    if (url.pathname === "/api/friends/profile") {
      if (request.method === "POST") return await createProfile(request, env);
      if (request.method === "PUT") return await updateProfile(request, env);
    }
    if (url.pathname === "/api/friends") {
      if (request.method === "GET") return await listFriends(request, env, url);
      if (request.method === "POST") return await addFriend(request, env);
    }
    const match = url.pathname.match(/^\/api\/friends\/(YJ-[A-Z2-9]{6})$/i);
    if (match && request.method === "DELETE") return await removeFriend(request, env, url, match[1]);
    return jsonResponse({ error: "不支持这个请求。" }, 405);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Friends API failed", error);
    return jsonResponse({ error: "好友服务暂时不可用，请稍后重试。" }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/friends")) return handleFriendsApi(request, env, url);

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || url.pathname.includes(".")) return response;
    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  },
};
