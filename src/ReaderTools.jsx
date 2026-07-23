import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Headphones,
  Pause,
  Play,
  SpeakerHigh,
  Stop,
  Waveform,
} from "@phosphor-icons/react";
import { contextualizeVocabularyEntry, sentenceForWord } from "./vocabulary-context.js";

function chunksForSpeech(text) {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const chunks = [];
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) continue;
    if (clean.length <= 320) chunks.push(clean);
    else for (let start = 0; start < clean.length; start += 300) chunks.push(clean.slice(start, start + 300));
  }
  return chunks.slice(0, 24);
}

function VocabularyPanel({ pageNumber, pageText, vocabulary, loading, onSpeakWord, selectedWord, onSelectWord }) {
  const words = useMemo(() => {
    if (!vocabulary?.words?.length || !pageText) return [];
    const entries = new Map(vocabulary.words.map((entry) => [entry.word.toLowerCase(), entry]));
    const seen = new Set();
    const matches = [];
    for (const token of pageText.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []) {
      const key = token.toLowerCase().replace("’", "'");
      if (seen.has(key) || !entries.has(key)) continue;
      seen.add(key);
      matches.push({
        ...contextualizeVocabularyEntry(entries.get(key), pageText, token),
        example: sentenceForWord(pageText, key),
      });
      if (matches.length === 8) break;
    }
    return matches;
  }, [pageText, vocabulary]);

  const selectFromKeyboard = (event, word) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectWord(word);
  };

  return <div className="reader-tool-content vocabulary-panel"><header><span><BookOpenText size={21} weight="duotone" /></span><div><strong>第 {pageNumber} 页重点词</strong><small>{vocabulary?.selection || "正在匹配年龄与词频"}</small></div><em className="vocabulary-count" aria-label={`本页共 ${words.length} 个重点词`}>{loading ? "…" : words.length}<small>个</small></em></header>{loading ? <div className="tool-loading"><i />正在整理本页单词…</div> : words.length ? <><p className="vocabulary-tip">本页共 {words.length} 个重点词 · 点击词卡可在正文中高亮定位</p><div className="vocabulary-list">{words.map((entry) => <article className={`vocabulary-card ${selectedWord === entry.lookupWord ? "is-selected" : ""}`} key={entry.lookupWord} role="button" tabIndex={0} aria-pressed={selectedWord === entry.lookupWord} onClick={() => onSelectWord(entry.lookupWord)} onKeyDown={(event) => selectFromKeyboard(event, entry.lookupWord)}><div className="vocabulary-word"><span><strong>{entry.displayWord}</strong>{entry.phonetic && <small>/{entry.phonetic}/</small>}</span><button type="button" onClick={(event) => { event.stopPropagation(); onSpeakWord(entry.displayWord); }} aria-label={`朗读单词 ${entry.displayWord}`}><SpeakerHigh size={18} weight="fill" /></button></div><div className="vocabulary-labels"><span>{entry.pos}</span><em>{entry.level}</em></div><p className="vocabulary-translation">{entry.translation}</p>{entry.definition && <p className="vocabulary-definition">{entry.definition}</p>}{entry.example && <blockquote>“{entry.example}”</blockquote>}<div className="vocabulary-source"><span>{entry.sourceLabel}</span><div><small>权威复核</small>{entry.authorityLinks.map((source) => <a href={source.url} key={source.label} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{source.label}</a>)}</div></div></article>)}</div></> : <div className="tool-empty"><BookOpenText size={36} weight="duotone" /><strong>{pageText ? "本页没有需要特别解释的词" : "这是封面或插图页"}</strong><p>继续翻页后，会自动整理当前可见文字中的重点词。</p></div>}<footer>人名与角色名优先按本书语境解释；普通词义来自 ECDICT，并提供剑桥英汉、柯林斯英汉与韦氏学生词典复核入口。</footer></div>;
}

function AudioPanel({ book, pageNumber, pageText, preferredVoice, voices, voiceName, setVoiceName, rate, setRate, speechState, onToggleSpeech, onStopSpeech, audioRef }) {
  const [trackIndex, setTrackIndex] = useState(0);
  const audiobook = book.audiobook;
  const track = audiobook?.sections?.[trackIndex];

  useEffect(() => setTrackIndex(0), [book.id]);

  return <div className="reader-tool-content audio-panel"><section className="page-narration"><header><span><Waveform size={22} weight="duotone" /></span><div><strong>设备语音 · 朗读本页</strong><small>每本书都可用 · 当前第 {pageNumber} 页</small></div></header><div className="narration-controls"><button className="narration-play" type="button" onClick={onToggleSpeech} disabled={!pageText}><span>{speechState === "playing" ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}</span>{speechState === "playing" ? "暂停" : speechState === "paused" ? "继续朗读" : "朗读本页"}</button><button type="button" onClick={onStopSpeech} disabled={speechState === "idle"} aria-label="停止朗读"><Stop size={18} weight="fill" /></button></div><label>英文声音<select value={voiceName} onChange={(event) => setVoiceName(event.target.value)}>{voices.length ? voices.map((voice) => <option value={voice.name} key={`${voice.name}-${voice.lang}`}>{voice.name} · {voice.lang}</option>) : <option value="">{preferredVoice?.name || "设备默认英文声音"}</option>}</select></label><label>朗读速度<select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value="0.75">慢速 0.75×</option><option value="0.9">儿童舒缓 0.9×</option><option value="1">标准 1.0×</option><option value="1.15">流畅 1.15×</option></select></label><p>设备语音仅朗读当前可见文字，翻页后可继续点击朗读。</p></section>{audiobook ? <section className="public-audiobook"><header><span><Headphones size={22} weight="duotone" /></span><div><strong>LibriVox 真人有声书</strong><small>{audiobook.totalTime} · {audiobook.narrator}</small></div></header><label>选择章节<select value={trackIndex} onChange={(event) => setTrackIndex(Number(event.target.value))}>{audiobook.sections.map((section, index) => <option value={index} key={`${section.number}-${section.audioUrl}`}>{section.number || index + 1}. {section.title}</option>)}</select></label><audio ref={audioRef} key={track?.audioUrl} controls preload="none" src={track?.audioUrl} onPlay={onStopSpeech} onEnded={() => setTrackIndex((current) => Math.min(audiobook.sections.length - 1, current + 1))} /><p>当前朗读：{track?.reader}</p><a href={audiobook.projectUrl} target="_blank" rel="noreferrer">查看 LibriVox 公版来源</a></section> : <section className="public-audiobook is-fallback"><Headphones size={34} weight="duotone" /><strong>暂未找到可靠的真人公版录音</strong><p>上方设备语音已经覆盖本书全部正文，可逐页朗读。</p></section>}</div>;
}

export function ReaderTools({ book, pageNumber, pageText, vocabulary, vocabularyLoading, selectedWord, onSelectWord }) {
  const [activeTab, setActiveTab] = useState("词典");
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState("");
  const [rate, setRate] = useState(0.9);
  const [speechState, setSpeechState] = useState("idle");
  const speechQueue = useRef([]);
  const audioRef = useRef(null);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!speechSupported) return undefined;
    const loadVoices = () => {
      const english = window.speechSynthesis.getVoices().filter((voice) => /^en[-_]/i.test(voice.lang));
      setVoices(english);
      setVoiceName((current) => current || english.find((voice) => /Samantha|Daniel|Google US English|Microsoft (?:Aria|Jenny)/i.test(voice.name))?.name || english[0]?.name || "");
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
  }, [speechSupported]);

  const selectedVoice = voices.find((voice) => voice.name === voiceName) || voices[0];
  const stopSpeech = () => {
    if (speechSupported) window.speechSynthesis.cancel();
    speechQueue.current = [];
    setSpeechState("idle");
  };
  const speakNext = () => {
    const next = speechQueue.current.shift();
    if (!next) { setSpeechState("idle"); return; }
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = selectedVoice?.lang || "en-US";
    utterance.voice = selectedVoice || null;
    utterance.rate = rate;
    utterance.pitch = 1.03;
    utterance.onend = speakNext;
    utterance.onerror = () => setSpeechState("idle");
    window.speechSynthesis.speak(utterance);
  };
  const toggleSpeech = () => {
    if (!speechSupported || !pageText) return;
    audioRef.current?.pause();
    if (speechState === "playing") { window.speechSynthesis.pause(); setSpeechState("paused"); return; }
    if (speechState === "paused") { window.speechSynthesis.resume(); setSpeechState("playing"); return; }
    stopSpeech();
    speechQueue.current = chunksForSpeech(pageText);
    if (!speechQueue.current.length) return;
    setSpeechState("playing");
    speakNext();
  };
  const speakWord = (word) => {
    if (!speechSupported) return;
    stopSpeech();
    audioRef.current?.pause();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = selectedVoice?.lang || "en-US";
    utterance.voice = selectedVoice || null;
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => stopSpeech, [book.id, pageNumber]);

  return <aside className="reader-tools" aria-label="阅读学习助手"><nav><button className={activeTab === "词典" ? "is-active" : ""} type="button" onClick={() => setActiveTab("词典")}><BookOpenText size={18} weight="fill" />本页词典</button><button className={activeTab === "朗读" ? "is-active" : ""} type="button" onClick={() => setActiveTab("朗读")}><Headphones size={18} weight="fill" />听书朗读</button></nav>{activeTab === "词典" ? <VocabularyPanel pageNumber={pageNumber} pageText={pageText} vocabulary={vocabulary} loading={vocabularyLoading} onSpeakWord={speakWord} selectedWord={selectedWord} onSelectWord={onSelectWord} /> : <AudioPanel book={book} pageNumber={pageNumber} pageText={pageText} preferredVoice={selectedVoice} voices={voices} voiceName={voiceName} setVoiceName={setVoiceName} rate={rate} setRate={setRate} speechState={speechState} onToggleSpeech={toggleSpeech} onStopSpeech={stopSpeech} audioRef={audioRef} />}</aside>;
}
