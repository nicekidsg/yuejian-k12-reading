import { useEffect, useState } from "react";
import {
  ArrowClockwise,
  BookOpen,
  CheckCircle,
  Copy,
  ShieldCheck,
  Trash,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";
import { categories } from "./data/books";

async function requestJson(url, options = {}, identity) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(identity?.secret ? { Authorization: `Bearer ${identity.secret}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "好友服务暂时不可用");
  return payload;
}

function formatUpdatedAt(value) {
  if (!value) return "尚未打卡";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近已更新";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function MiniProgress({ value }) {
  const percent = Math.max(0, Math.min(100, Math.round(value || 0)));
  return <span className="friend-progress-line" aria-label={`完成 ${percent}%`}><i style={{ width: `${percent}%` }} /></span>;
}

export function FriendsView({ identity, setIdentity, summary, showToast }) {
  const [nickname, setNickname] = useState(identity.nickname || "");
  const [friendCode, setFriendCode] = useState("");
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setNickname(identity.nickname || ""), [identity.nickname]);

  const loadFriends = async () => {
    if (!identity.id) return;
    setLoading(true); setError("");
    try {
      const payload = await requestJson(`/api/friends?ownerId=${encodeURIComponent(identity.id)}`, {}, identity);
      setFriends(payload.friends || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!identity.id) return undefined;
    loadFriends();
    const interval = window.setInterval(loadFriends, 30_000);
    return () => window.clearInterval(interval);
  }, [identity.id, identity.secret]);

  const createProfile = async (event) => {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const payload = await requestJson("/api/friends/profile", {
        method: "POST",
        body: JSON.stringify({ nickname: nickname.trim() || "小读者" }),
      });
      setIdentity(payload.identity);
      showToast("好友码创建成功");
    } catch (createError) {
      setError(createError.message);
    } finally {
      setLoading(false);
    }
  };

  const saveNickname = () => {
    const nextNickname = nickname.trim().slice(0, 20);
    if (!nextNickname) return;
    setIdentity((current) => ({ ...current, nickname: nextNickname }));
    showToast("昵称已更新");
  };

  const copyFriendCode = async () => {
    try {
      await navigator.clipboard.writeText(identity.friendCode);
      showToast("好友码已复制");
    } catch {
      showToast(`好友码：${identity.friendCode}`);
    }
  };

  const addFriend = async (event) => {
    event.preventDefault();
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setError("");
    try {
      await requestJson("/api/friends", {
        method: "POST",
        body: JSON.stringify({ ownerId: identity.id, friendCode: code }),
      }, identity);
      setFriendCode("");
      await loadFriends();
      showToast("好友已添加");
    } catch (addError) {
      setError(addError.message);
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = async (code) => {
    setLoading(true); setError("");
    try {
      await requestJson(`/api/friends/${encodeURIComponent(code)}?ownerId=${encodeURIComponent(identity.id)}`, {
        method: "DELETE",
      }, identity);
      setFriends((current) => current.filter((friend) => friend.friendCode !== code));
      showToast("好友已移除");
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!identity.id) {
    return <div className="view-screen friends-view"><section className="friend-welcome"><span className="friend-welcome-icon"><UsersThree size={48} weight="duotone" /></span><p className="eyebrow">一起坚持阅读</p><h1>创建你的好友码</h1><p>无需手机号或真实姓名。填写一个昵称，生成好友码后即可与同学分享阅读打卡。</p><form onSubmit={createProfile}><label htmlFor="reader-nickname">阅读昵称</label><input id="reader-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} placeholder="例如：小海豚" /><button className="primary-button" type="submit" disabled={loading}><UserPlus size={19} weight="fill" />{loading ? "正在创建…" : "创建好友码"}</button></form>{error && <p className="friend-error" role="alert">{error}</p>}<div className="friend-privacy"><ShieldCheck size={19} weight="fill" /><span>只公开昵称与汇总进度，不收集手机号、学校或真实姓名。请在家长知情下使用。</span></div></section></div>;
  }

  return (
    <div className="view-screen friends-view">
      <section className="friend-profile-card">
        <div className="friend-avatar">{identity.nickname?.slice(0, 1) || "阅"}</div>
        <div className="friend-profile-copy"><p className="eyebrow">我的阅读身份</p><h1>{identity.nickname}</h1><button type="button" onClick={copyFriendCode}><strong>{identity.friendCode}</strong><Copy size={17} />复制好友码</button></div>
        <div className="friend-own-stats"><span><strong>{summary.completedCount}</strong><small>已完成</small></span><span><strong>{summary.startedCount}</strong><small>正在读</small></span><span><strong>{summary.totalProgress}%</strong><small>总进度</small></span></div>
      </section>

      <section className="friend-actions-grid">
        <form className="friend-action-card" onSubmit={addFriend}><p className="eyebrow"><UserPlus size={18} weight="fill" /> 添加好友</p><h2>输入对方的好友码</h2><div><input value={friendCode} onChange={(event) => setFriendCode(event.target.value.toUpperCase())} placeholder="YJ-XXXXXX" maxLength={9} aria-label="好友码" /><button className="primary-button" type="submit" disabled={loading}>添加</button></div></form>
        <div className="friend-action-card"><p className="eyebrow"><ShieldCheck size={18} weight="fill" /> 昵称设置</p><h2>保持信息简单安全</h2><div><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} aria-label="阅读昵称" /><button className="secondary-button" type="button" onClick={saveNickname}>保存</button></div></div>
      </section>

      {error && <p className="friend-error" role="alert">{error}</p>}
      <section className="friend-list-section">
        <header className="section-heading"><div><p className="eyebrow">好友打卡 · 每 30 秒自动更新</p><h2>{friends.length ? `${friends.length} 位阅读伙伴` : "还没有添加好友"}</h2></div><button type="button" onClick={loadFriends} disabled={loading}><ArrowClockwise size={17} />刷新进度</button></header>
        {friends.length ? <div className="friend-grid">{friends.map((friend) => <article className="friend-card" key={friend.friendCode}><header><span className="friend-avatar small">{friend.nickname.slice(0, 1)}</span><span><strong>{friend.nickname}</strong><small>{friend.friendCode} · {formatUpdatedAt(friend.updatedAt)}</small></span><button type="button" onClick={() => removeFriend(friend.friendCode)} aria-label={`移除好友 ${friend.nickname}`}><Trash size={16} /></button></header><div className="friend-card-stats"><span><CheckCircle size={21} weight="duotone" /><strong>{friend.completedCount}</strong><small>完成</small></span><span><BookOpen size={21} weight="duotone" /><strong>{friend.startedCount}</strong><small>在读</small></span><span><UsersThree size={21} weight="duotone" /><strong>{friend.totalProgress}%</strong><small>总进度</small></span></div><MiniProgress value={friend.totalProgress} />{friend.lastBookTitle && <p className="friend-last-book">最近在读：<strong>{friend.lastBookTitle}</strong></p>}<div className="friend-category-progress">{categories.map((category) => <span key={category.id}><i className={category.tone} />{category.name}<b>{friend.categoryCounts?.[category.id] || 0}/20</b></span>)}</div></article>)}</div> : <div className="friend-empty"><UsersThree size={44} weight="duotone" /><h3>分享好友码，一起读下去</h3><p>对方创建好友码后，你可以在上方输入并查看其公开打卡进度。</p></div>}
      </section>
    </div>
  );
}
