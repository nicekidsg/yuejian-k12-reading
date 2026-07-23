import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookBookmark,
  BookOpen,
  BookOpenText,
  BookmarkSimple,
  Books,
  CaretDown,
  CheckCircle,
  Compass,
  Footprints,
  GlobeHemisphereEast,
  Headphones,
  House,
  Leaf,
  MagnifyingGlass,
  Mountains,
  PawPrint,
  RocketLaunch,
  ShieldCheck,
  Sparkle,
  Star,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { ageFilters, books, categories, featuredBooks } from "./data/books";
import { FriendsView } from "./FriendsView";
import { ReaderTools } from "./ReaderTools";

const STORAGE_VERSION = "yuejian-v3";
const navItems = [
  { label: "首页", icon: House },
  { label: "探索", icon: Compass },
  { label: "我的书架", icon: Books },
  { label: "阅读足迹", icon: Footprints },
  { label: "好友", icon: UsersThree },
];
const categoryIcons = {
  fantasy: Sparkle,
  adventure: RocketLaunch,
  animals: PawPrint,
  growth: UsersThree,
  world: GlobeHemisphereEast,
};

function useStoredSet(key) {
  const [value, setValue] = useState(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(key) || "[]"));
    } catch {
      return new Set();
    }
  });
  useEffect(() => window.localStorage.setItem(key, JSON.stringify([...value])), [key, value]);
  return [value, setValue];
}

function useStoredObject(key) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => window.localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue];
}

function Logo() {
  return (
    <div className="brand" aria-label="阅见英语">
      <span className="brand-mark"><BookOpen size={38} weight="duotone" /><Sparkle size={15} weight="fill" /></span>
      <span><strong>阅见英语</strong><small>读懂世界 · 看见自己</small></span>
    </div>
  );
}

function NavButton({ item, active, onClick, compact = false }) {
  const Icon = item.icon;
  return (
    <button className={`nav-button ${active ? "is-active" : ""} ${compact ? "is-compact" : ""}`} type="button" onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon size={compact ? 21 : 23} weight={active ? "fill" : "regular"} /><span>{item.label}</span>
    </button>
  );
}

function ProgressBar({ value, label }) {
  const percent = Math.max(0, Math.min(100, Math.round(value || 0)));
  return <div className="progress-line" aria-label={`${label} ${percent}%`}><span style={{ width: `${percent}%` }} /></div>;
}

function BookCover({ book, compact = false }) {
  return (
    <div className={`book-cover ${compact ? "is-compact" : ""} tone-${book.tone}`}>
      <img src={book.cover} alt={`${book.title} 封面`} loading="lazy" />
      <span className="cover-fallback" aria-hidden="true"><BookOpen size={compact ? 28 : 40} weight="duotone" /></span>
    </div>
  );
}

function isAiImage(path) {
  return path?.startsWith("/ai-");
}

function illustrationCaption(book, path, index = 0) {
  if (isAiImage(path)) return `根据《${book.title}》内容生成的儿童插图`;
  if (index === 0) {
    return book.coverSource === "original-edition"
      ? `${book.title} · 原版封面`
      : `${book.title} · Gutenberg 版本封面`;
  }
  return `公版原书插图 · 第 ${index} 幅`;
}

function BookCard({ book, saved, progress, onOpen, onToggleSaved }) {
  return (
    <article className="catalog-card">
      <button className="catalog-card-main" type="button" onClick={() => onOpen(book)}>
        <BookCover book={book} compact />
        <span className="catalog-copy">
          <span className="catalog-category">{book.contentType || book.category}{book.priority?.startsWith("A") ? " · A档精选" : ""}</span>
          <strong>{book.title}</strong>
          <small>{book.author}</small>
          <span className="catalog-meta">{book.ageRange} · {book.level} · {book.pages} 页</span>
          {progress > 0 && <span className="card-progress"><ProgressBar value={progress} label="阅读进度" /><b>{progress}%</b></span>}
        </span>
      </button>
      <footer>
        <span><ShieldCheck size={15} weight="fill" /> 公版原著 · 配图可追溯</span>
        <button type="button" onClick={() => onToggleSaved(book.id)} aria-label={saved ? `取消收藏 ${book.title}` : `收藏 ${book.title}`}>
          <BookmarkSimple size={20} weight={saved ? "fill" : "regular"} /> {saved ? "已收藏" : "收藏"}
        </button>
      </footer>
    </article>
  );
}

function StarMap({ completedBooks, onExplore }) {
  const counts = Object.fromEntries(categories.map((category) => [
    category.id,
    books.filter((book) => book.themeId === category.id && completedBooks.has(book.id)).length,
  ]));
  return (
    <section className="reading-trail" aria-labelledby="trail-title">
      <div className="trail-intro"><p className="eyebrow">真实完成记录</p><h2 id="trail-title">你的阅读星图</h2><p>每个领域读完 5 本，就能点亮一颗领域星。</p></div>
      <div className="trail-steps">
        {categories.map((category) => {
          const Icon = categoryIcons[category.id];
          const count = counts[category.id];
          return (
            <button className={`trail-step ${count >= 5 ? "is-lit" : ""}`} type="button" key={category.id} onClick={() => onExplore(category.id)}>
              <span className={`trail-icon ${category.tone}`}><Icon size={27} weight="fill" /></span>
              <strong>{category.name}</strong><small>{Math.min(count, 5)}/5 本</small>
              <ProgressBar value={Math.min(100, count * 20)} label={`${category.name}星图进度`} />
            </button>
          );
        })}
      </div>
      <div className="trail-achievement"><Star size={38} weight={completedBooks.size ? "fill" : "regular"} /><span><strong>{completedBooks.size ? "继续发光" : "等待第一束星光"}</strong><small>已读完 {completedBooks.size} / {books.length} 本</small></span><ProgressBar value={Math.round((completedBooks.size / books.length) * 100)} label="全部馆藏完成进度" /></div>
    </section>
  );
}

function HomeView({ savedBooks, readingProgress, completedBooks, onNavigate, onOpenBook, onExplore }) {
  const inProgress = books.filter((book) => (readingProgress[book.id] || 0) > 0 && !completedBooks.has(book.id)).slice(0, 3);
  const displayBooks = inProgress.length ? inProgress : featuredBooks.slice(0, 3);
  return (
    <div className="view-screen home-view">
      <section className="home-hero">
        <div><p className="eyebrow"><Sparkle size={18} weight="fill" /> {books.length} 本免费英文原著</p><h1>从一本真正读得完的书开始</h1><p>所有书都可直接在站内阅读。收藏、进度与星图从 0 开始，只记录你的真实阅读。</p><button className="primary-button" type="button" onClick={() => onNavigate("探索")}>开始选书 <ArrowRight size={18} weight="bold" /></button></div>
        <div className="weekly-goal"><BookOpen size={36} weight="duotone" /><span><strong>第一次阅读目标</strong><small>{completedBooks.size}/5 本</small></span><ProgressBar value={Math.min(100, completedBooks.size * 20)} label="第一次阅读目标" /></div>
      </section>
      <section className="home-stats" aria-label="阅读概览">
        <div><CheckCircle size={25} weight="duotone" /><span><strong>{completedBooks.size}</strong><small>已完成</small></span></div>
        <div><BookmarkSimple size={25} weight="duotone" /><span><strong>{savedBooks.size}</strong><small>已收藏</small></span></div>
        <div><BookOpen size={25} weight="duotone" /><span><strong>{Object.values(readingProgress).filter((value) => value > 0 && value < 95).length}</strong><small>正在读</small></span></div>
        <div><Star size={25} weight="duotone" /><span><strong>{Math.round((completedBooks.size / books.length) * 100)}%</strong><small>总进度</small></span></div>
      </section>
      <section className="content-section">
        <header className="section-heading"><div><p className="eyebrow">{inProgress.length ? "继续阅读" : "从这里开始"}</p><h2>{inProgress.length ? "回到上次停下的地方" : "三本适合开启旅程的经典"}</h2></div><button type="button" onClick={() => onNavigate("探索")}>查看全部 <ArrowRight size={16} /></button></header>
        <div className="continue-grid">
          {displayBooks.map((book) => <button className="continue-card" type="button" key={book.id} onClick={() => onOpenBook(book)}><BookCover book={book} compact /><span><small>{book.category} · {book.level}</small><strong>{book.title}</strong><em>{readingProgress[book.id] ? `已读 ${readingProgress[book.id]}%` : `${book.author}`}</em></span><ArrowRight size={19} /></button>)}
        </div>
      </section>
      <section className="content-section">
        <header className="section-heading"><div><p className="eyebrow">兴趣领域</p><h2>沿着喜欢的方向出发</h2></div><span className="catalog-total">共 {books.length} 本</span></header>
        <div className="category-quick-grid">
          {categories.map((category) => { const Icon = categoryIcons[category.id]; const count = books.filter((book) => book.themeId === category.id).length; return <button className={`category-quick tone-${category.tone}`} type="button" key={category.id} onClick={() => onExplore(category.id)}><span className={`catalog-symbol ${category.tone}`}><Icon size={29} weight="fill" /></span><span><strong>{category.name}</strong><small>{category.description} · {count} 本</small></span><ArrowRight size={18} /></button>; })}
        </div>
      </section>
      <StarMap completedBooks={completedBooks} onExplore={onExplore} />
    </div>
  );
}

function ExploreView({ selectedTheme, setSelectedTheme, filterLevel, setFilterLevel, filterAge, setFilterAge, filteredBooks, visibleCount, setVisibleCount, savedBooks, readingProgress, onOpenBook, onToggleSaved, onExplore }) {
  const heroTheme = selectedTheme === "全部" ? categories[0].id : selectedTheme;
  const selectedCategory = categories.find((category) => category.id === heroTheme);
  const selectedBook = featuredBooks[categories.findIndex((category) => category.id === heroTheme)];
  return (
    <div className="view-screen explore-view">
      <section className="explore-hero">
        <div className="explore-copy"><p className="eyebrow"><Compass size={18} weight="fill" /> 探索真实书海</p><h1>{books.length} 本可直接阅读的英文故事</h1><p>以 200 本中国儿童英语公版精选书单为核心，补充 Project Gutenberg 儿童文学与低龄绘本。完整正文已内置，点击即可阅读。</p><div className="theme-pills">{categories.map((category) => { const Icon = categoryIcons[category.id]; return <button className={selectedTheme === category.id ? "is-active" : ""} type="button" key={category.id} onClick={() => onExplore(category.id)}><Icon size={18} weight="fill" />{category.name}</button>; })}</div></div>
        <div className="featured-book"><BookCover book={selectedBook} /><div><span className="feature-label">{selectedCategory.name} · 热门经典</span><h2>{selectedBook.title}</h2><p>{selectedBook.author}</p><small>{selectedBook.ageRange} · {selectedBook.level} · {selectedBook.pages} 页</small><button className="primary-button" type="button" onClick={() => onOpenBook(selectedBook)}>查看并阅读 <ArrowRight size={17} /></button></div></div>
      </section>
      <section className="catalog-section" aria-labelledby="catalog-title">
        <header className="catalog-header"><div><p className="eyebrow">完整馆藏</p><h2 id="catalog-title">{selectedTheme === "全部" ? `全部 ${books.length} 本` : selectedCategory?.name}</h2><p>可按年龄、主题与难度组合筛选，建议先试读再决定。</p></div><span className="catalog-count"><strong>{filteredBooks.length}</strong><small>本匹配</small></span></header>
        <div className="catalog-filters"><div className="filter-group"><strong>年龄</strong><button className={filterAge === "全部" ? "is-active" : ""} type="button" onClick={() => { setFilterAge("全部"); setVisibleCount(20); }}>全部</button>{ageFilters.map((age) => <button className={filterAge === age.id ? "is-active" : ""} type="button" key={age.id} onClick={() => { setFilterAge(age.id); setVisibleCount(20); }}>{age.label}</button>)}</div><div className="filter-group"><strong>主题</strong><button className={selectedTheme === "全部" ? "is-active" : ""} type="button" onClick={() => { setSelectedTheme("全部"); setVisibleCount(20); }}>全部</button>{categories.map((category) => <button className={selectedTheme === category.id ? "is-active" : ""} type="button" key={category.id} onClick={() => { setSelectedTheme(category.id); setVisibleCount(20); }}>{category.name}</button>)}</div><div className="filter-group"><strong>难度</strong>{["全部", "入门", "进阶", "挑战"].map((level) => <button className={filterLevel === level ? "is-active" : ""} type="button" key={level} onClick={() => { setFilterLevel(level); setVisibleCount(20); }}>{level}</button>)}</div></div>
        {filteredBooks.length ? <><div className="catalog-grid">{filteredBooks.slice(0, visibleCount).map((book) => <BookCard key={book.id} book={book} saved={savedBooks.has(book.id)} progress={readingProgress[book.id] || 0} onOpen={onOpenBook} onToggleSaved={onToggleSaved} />)}</div>{visibleCount < filteredBooks.length && <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + 20)}>再看 20 本 <CaretDown size={18} /></button>}</> : <EmptyState title="没有匹配的读物" copy="换一个关键词或筛选条件试试。" />}
      </section>
    </div>
  );
}

function ShelfView({ savedBooks, readingProgress, onOpenBook, onToggleSaved, onNavigate }) {
  const shelf = books.filter((book) => savedBooks.has(book.id));
  return <div className="view-screen shelf-view"><PageHeading eyebrow="真实收藏" title="我的书架" copy="这里不会预置任何书。只有你亲自收藏的读物才会出现。" count={shelf.length} countLabel="本藏书" icon={BookBookmark} />{shelf.length ? <div className="shelf-library-grid">{shelf.map((book) => <article className="shelf-library-card" key={book.id}><button className="shelf-library-main" type="button" onClick={() => onOpenBook(book)}><BookCover book={book} compact /><span><small>{book.category} · {book.ageRange}</small><strong>{book.title}</strong><em>{readingProgress[book.id] ? `已读 ${readingProgress[book.id]}%` : "尚未开始"}</em><ProgressBar value={readingProgress[book.id] || 0} label="阅读进度" /></span></button><div className="shelf-library-actions"><button type="button" onClick={() => onOpenBook(book)}><BookOpen size={18} />{readingProgress[book.id] ? "继续阅读" : "开始阅读"}</button><button type="button" onClick={() => onToggleSaved(book.id)}><X size={18} />取消收藏</button></div></article>)}</div> : <EmptyState large icon={Books} title="书架还是空的" copy={`去 ${books.length} 本馆藏中收藏一本感兴趣的英文故事吧。`} action={<button className="primary-button" type="button" onClick={() => onNavigate("探索")}>去探索 <ArrowRight size={17} /></button>} />}</div>;
}

function TrailView({ completedBooks, readingProgress, onExplore, onOpenBook }) {
  const completed = books.filter((book) => completedBooks.has(book.id));
  const started = books.filter((book) => (readingProgress[book.id] || 0) > 0);
  return <div className="view-screen trail-view"><PageHeading eyebrow="真实阅读记录" title="阅读足迹" copy="滚动阅读会自动保存进度；读到 95% 后才计为完成。" count={completed.length} countLabel="本已完成" icon={Footprints} /><StarMap completedBooks={completedBooks} onExplore={onExplore} /><section className="content-section history-section"><header className="section-heading"><div><p className="eyebrow">阅读记录</p><h2>{started.length ? "已经走过的阅读航线" : "还没有阅读记录"}</h2></div><span className="catalog-total">开始 {started.length} 本</span></header>{started.length ? <div className="history-list">{started.sort((a, b) => (readingProgress[b.id] || 0) - (readingProgress[a.id] || 0)).map((book) => <button type="button" key={book.id} onClick={() => onOpenBook(book)}><CheckCircle size={23} weight={completedBooks.has(book.id) ? "fill" : "regular"} /><span><strong>{book.title}</strong><small>{book.category} · {completedBooks.has(book.id) ? "已完成" : `已读 ${readingProgress[book.id]}%`}</small></span><ProgressBar value={readingProgress[book.id]} label="阅读进度" /><ArrowRight size={17} /></button>)}</div> : <EmptyState icon={Footprints} title="第一步等你出发" copy="打开任意一本书并开始阅读，这里就会出现真实进度。" />}</section></div>;
}

function PageHeading({ eyebrow, title, copy, count, countLabel, icon: Icon }) {
  return <header className="page-heading"><div><p className="eyebrow"><Icon size={19} weight="fill" /> {eyebrow}</p><h1>{title}</h1><p>{copy}</p></div><span className="page-count"><strong>{count}</strong><small>{countLabel}</small></span></header>;
}

function EmptyState({ title, copy, action, icon: Icon = MagnifyingGlass, large = false }) {
  return <div className={`empty-state ${large ? "is-large" : ""}`}><Icon size={large ? 48 : 36} weight="duotone" /><h2>{title}</h2><p>{copy}</p>{action}</div>;
}

function BookDetail({ book, saved, progress, onClose, onToggleSaved, onRead }) {
  if (!book) return null;
  const originalImageCount = book.originalIllustrations.length + (book.coverSource === "original-edition" ? 1 : 0);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={onClose} aria-label="关闭"><X size={22} weight="bold" /></button><div className="detail-visual"><BookCover book={book} /><span className="availability-text"><ShieldCheck size={17} weight="fill" /> {originalImageCount} 张原版图{book.aiIllustrations.length ? ` · ${book.aiIllustrations.length} 张 AI 补图` : ""}</span><span className="availability-text"><Headphones size={17} weight="fill" /> {book.audiobook ? "LibriVox 真人有声书" : "设备英文语音朗读"}</span></div><div className="detail-copy"><p className="eyebrow">{book.category} · {book.contentType || book.level}</p><h2 id="detail-title">{book.title}</h2><p className="detail-author">{book.author}</p><p>{book.description}</p><div className="book-facts"><span><strong>{book.ageRange}</strong> 建议年龄</span><span><strong>{book.wordCount.toLocaleString()}</strong> 英文词</span><span><strong>{book.pages}</strong> 估算页</span><span><strong>{book.minutes}</strong> 估算分钟</span></div>{book.readingSuggestion && <div className="detail-guidance"><span><strong>建议读法</strong>{book.readingSuggestion}</span><span><strong>内容组织</strong>{book.organizationSuggestion}</span></div>}{book.readingWarning && !book.readingWarning.startsWith("无特别提醒") && <div className="detail-warning"><strong>阅读提醒</strong>{book.readingWarning}</div>}{progress > 0 && <div className="detail-progress"><span>你的阅读进度 <b>{progress}%</b></span><ProgressBar value={progress} label="你的阅读进度" /></div>}<div className="detail-trust"><ShieldCheck size={20} weight="fill" /><span>年龄与难度为 EFL 学习场景建议；原版图片保留来源，AI 补图会明确标注。<a href={book.textSourceUrl || book.sourceUrl} target="_blank" rel="noreferrer">查看原始来源</a></span></div><div className="detail-actions"><button className="primary-button" type="button" onClick={() => onRead(book)}><BookOpen size={19} weight="fill" />{progress ? "继续阅读" : "开始阅读"}</button><button className={`secondary-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => onToggleSaved(book.id)}><BookmarkSimple size={19} weight={saved ? "fill" : "regular"} />{saved ? "已收藏" : "收藏"}</button></div></div></section></div>;
}

function illustratedSections(text, illustrations) {
  const available = illustrations.slice(1);
  const illustrationGap = Math.max(5_400, Math.floor(text.length / (available.length + 1)));
  const usable = available.filter((_, index) => (index + 1) * illustrationGap < text.length);
  const sections = [];
  let start = 0;
  for (const [index, illustration] of usable.entries()) {
    const approximateEnd = Math.min(text.length, (index + 1) * illustrationGap);
    const paragraphEnd = text.indexOf("\n\n", approximateEnd);
    const end = paragraphEnd > -1 && paragraphEnd - approximateEnd < 1_200 ? paragraphEnd : approximateEnd;
    sections.push({ text: text.slice(start, end), illustration });
    start = end;
  }
  sections.push({ text: text.slice(start), illustration: null });
  return sections;
}

function HighlightedText({ text, word }) {
  if (!word) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(\\b${escaped}\\b)`, "gi"));
  return parts.map((part, index) => part.toLowerCase() === word.toLowerCase() ? <mark className="reader-word-highlight" data-highlight-word={word.toLowerCase()} key={`${part}-${index}`}>{part}</mark> : part);
}

function Reader({ book, progress, onClose, onProgress }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const [pageText, setPageText] = useState("");
  const [vocabulary, setVocabulary] = useState(null);
  const [vocabularyLoading, setVocabularyLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(() => window.innerWidth > 900);
  const [selectedWord, setSelectedWord] = useState("");
  const scrollRef = useRef(null);
  const restored = useRef(false);
  const syncFrame = useRef(null);
  const sections = useMemo(() => illustratedSections(text, book.illustrations), [text, book.illustrations]);

  const updateReaderView = (element) => {
    if (!element) return;
    const pageHeight = Math.max(1, element.clientHeight);
    const total = Math.max(1, Math.ceil(element.scrollHeight / pageHeight));
    const current = Math.max(1, Math.min(total, Math.floor(element.scrollTop / pageHeight) + 1));
    setPageInfo((previous) => previous.current === current && previous.total === total ? previous : { current, total });
    const viewport = element.getBoundingClientRect();
    const visibleText = [...element.querySelectorAll(".reader-text-block")]
      .filter((block) => { const bounds = block.getBoundingClientRect(); return bounds.bottom > viewport.top + 12 && bounds.top < viewport.bottom - 12; })
      .map((block) => block.textContent)
      .join("\n\n")
      .trim()
      .slice(0, 6_000);
    setPageText((previous) => previous === visibleText ? previous : visibleText);
  };

  const scheduleReaderView = (element) => {
    window.cancelAnimationFrame(syncFrame.current);
    syncFrame.current = window.requestAnimationFrame(() => updateReaderView(element));
  };

  useEffect(() => {
    let cancelled = false;
    setText(""); setError(""); setSelectedWord(""); restored.current = false;
    (async () => {
      try {
        const response = await fetch(book.textPath);
        if (!response.ok) throw new Error("正文加载失败");
        const content = await response.text();
        if (!cancelled) setText(content);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "正文加载失败");
      }
    })();
    return () => { cancelled = true; };
  }, [book]);

  useEffect(() => {
    let cancelled = false;
    setVocabulary(null); setVocabularyLoading(true);
    fetch(book.vocabularyPath).then((response) => {
      if (!response.ok) throw new Error("词汇加载失败");
      return response.json();
    }).then((payload) => { if (!cancelled) setVocabulary(payload); }).catch(() => { if (!cancelled) setVocabulary({ words: [], selection: `按 ${book.ageRange} 筛选` }); }).finally(() => { if (!cancelled) setVocabularyLoading(false); });
    return () => { cancelled = true; };
  }, [book]);

  useEffect(() => {
    if (!text || restored.current || !scrollRef.current) return;
    restored.current = true;
    requestAnimationFrame(() => {
      const element = scrollRef.current;
      element.scrollTop = ((element.scrollHeight - element.clientHeight) * progress) / 100;
      updateReaderView(element);
    });
  }, [text, progress]);

  useEffect(() => {
    const timeout = window.setTimeout(() => updateReaderView(scrollRef.current), 220);
    return () => window.clearTimeout(timeout);
  }, [toolsOpen, text]);

  useEffect(() => () => window.cancelAnimationFrame(syncFrame.current), []);

  useEffect(() => {
    if (!selectedWord || !scrollRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      const viewport = element.getBoundingClientRect();
      const marks = [...element.querySelectorAll(".reader-word-highlight")];
      const target = marks.find((mark) => { const bounds = mark.getBoundingClientRect(); return bounds.bottom > viewport.top && bounds.top < viewport.bottom; }) || marks[0];
      target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedWord]);

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const range = element.scrollHeight - element.clientHeight;
    const next = range <= 0 ? 100 : Math.round((element.scrollTop / range) * 100);
    scheduleReaderView(element);
    if (next > progress) onProgress(book.id, next);
  };

  const turnPage = (direction) => {
    const element = scrollRef.current;
    if (!element) return;
    setSelectedWord("");
    element.scrollTo({ top: element.scrollTop + element.clientHeight * direction, behavior: "smooth" });
  };

  return <div className="reader-shell" role="dialog" aria-modal="true" aria-labelledby="reader-title"><header className="reader-header"><button type="button" onClick={onClose}><ArrowLeft size={20} weight="bold" />返回书目</button><div className="reader-book-title"><strong id="reader-title">{book.title}</strong><small>{book.author} · {book.ageRange}</small></div><button className={`reader-tools-toggle ${toolsOpen ? "is-active" : ""}`} type="button" onClick={() => setToolsOpen((open) => !open)} aria-pressed={toolsOpen}><BookOpenText size={18} weight="fill" />学习助手</button><span className="reader-percent">{progress}%</span><button className="reader-close" type="button" onClick={onClose} aria-label="关闭阅读器"><X size={21} /></button></header><div className="reader-progress"><ProgressBar value={progress} label="阅读进度" /></div>{error ? <div className="reader-status"><BookOpen size={42} weight="duotone" /><h2>暂时无法打开正文</h2><p>{error}</p><button className="secondary-button" type="button" onClick={onClose}>返回</button></div> : !text ? <div className="reader-status"><span className="reader-loader" /><h2>正在打开完整原著…</h2><p>正文、词典与朗读工具正在准备。</p></div> : <div className={`reader-body ${toolsOpen ? "" : "is-tools-closed"}`}><main className="reader-scroll" ref={scrollRef} onScroll={handleScroll}><article><p className="reader-source">Project Gutenberg #{book.catalogGutenbergId || book.gutenbergId} · Public-domain English text · Images individually credited</p><figure className="reader-illustration hero"><img src={book.illustrations[0]} alt={`${book.title} 封面插图`} onLoad={() => updateReaderView(scrollRef.current)} /><figcaption>{illustrationCaption(book, book.illustrations[0], 0)}</figcaption></figure>{sections.map((section, index) => <section className="reader-text-section" key={`${section.illustration || "ending"}-${index}`}>{section.text.split(/\n{2,}/).filter(Boolean).map((block, blockIndex) => <pre className="reader-text-block" key={`${index}-${blockIndex}`}><HighlightedText text={block.trim()} word={selectedWord} /></pre>)}{section.illustration && <figure className={`reader-illustration ${isAiImage(section.illustration) ? "is-ai" : ""}`}><img src={section.illustration} alt={`${book.title} 内容插图 ${index + 1}`} loading="lazy" onLoad={() => updateReaderView(scrollRef.current)} /><figcaption>{illustrationCaption(book, section.illustration, index + 1)}</figcaption></figure>}</section>)}<div className="reader-finish"><Star size={42} weight="fill" /><h2>你读到故事的最后一页了</h2><p>这本书已计入阅读足迹与星图。</p></div></article></main>{toolsOpen && <ReaderTools book={book} pageNumber={pageInfo.current} pageText={pageText} vocabulary={vocabulary} vocabularyLoading={vocabularyLoading} selectedWord={selectedWord} onSelectWord={(word) => setSelectedWord((current) => current === word ? "" : word)} />}</div>}<footer className="reader-pagination"><button type="button" onClick={() => turnPage(-1)} disabled={pageInfo.current <= 1}><ArrowLeft size={18} />上一页</button><span><strong>第 {pageInfo.current} 页</strong><small>共 {pageInfo.total} 页</small></span><button type="button" onClick={() => turnPage(1)} disabled={pageInfo.current >= pageInfo.total}>下一页<ArrowRight size={18} /></button></footer></div>;
}

export function App() {
  const [activeView, setActiveView] = useState("首页");
  const [selectedTheme, setSelectedTheme] = useState("全部");
  const [filterLevel, setFilterLevel] = useState("全部");
  const [filterAge, setFilterAge] = useState("全部");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [detailBook, setDetailBook] = useState(null);
  const [readerBook, setReaderBook] = useState(null);
  const [savedBooks, setSavedBooks] = useStoredSet(`${STORAGE_VERSION}-saved`);
  const [readingProgress, setReadingProgress] = useStoredObject(`${STORAGE_VERSION}-progress`);
  const [friendIdentity, setFriendIdentity] = useStoredObject(`${STORAGE_VERSION}-friend-identity`);
  const [toast, setToast] = useState("");
  const completedBooks = useMemo(() => new Set(books.filter((book) => (readingProgress[book.id] || 0) >= 95).map((book) => book.id)), [readingProgress]);
  const friendSummary = useMemo(() => {
    const started = books.filter((book) => (readingProgress[book.id] || 0) > 0);
    const categoryCounts = Object.fromEntries(categories.map((category) => [
      category.id,
      books.filter((book) => book.themeId === category.id && completedBooks.has(book.id)).length,
    ]));
    const lastBook = started.at(-1);
    return {
      completedCount: completedBooks.size,
      startedCount: started.length,
      totalProgress: started.length ? Math.round(started.reduce((sum, book) => sum + (readingProgress[book.id] || 0), 0) / started.length) : 0,
      categoryCounts,
      lastBookTitle: lastBook?.title || "",
    };
  }, [readingProgress, completedBooks]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((book) => (!normalized || `${book.title} ${book.author} ${book.category} ${book.secondaryCategory || ""} ${book.contentType || ""} ${book.level} ${book.ageRange}`.toLowerCase().includes(normalized)) && (selectedTheme === "全部" || book.themeId === selectedTheme) && (filterLevel === "全部" || book.level === filterLevel) && (filterAge === "全部" || book.ageGroup === filterAge));
  }, [query, selectedTheme, filterLevel, filterAge]);

  useEffect(() => {
    if (!friendIdentity.id || !friendIdentity.secret) return undefined;
    const timeout = window.setTimeout(() => {
      fetch("/api/friends/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${friendIdentity.secret}` },
        body: JSON.stringify({ id: friendIdentity.id, nickname: friendIdentity.nickname, progress: friendSummary }),
      }).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [friendIdentity, friendSummary]);

  useEffect(() => {
    const close = (event) => { if (event.key === "Escape") { setDetailBook(null); setReaderBook(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 1900); };
  const navigate = (view) => { setActiveView(view); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const explore = (themeId = "全部") => { setSelectedTheme(themeId); setVisibleCount(20); navigate("探索"); };
  const toggleSaved = (id) => { const removing = savedBooks.has(id); setSavedBooks((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); showToast(removing ? "已取消收藏" : "已收藏到书架"); };
  const updateProgress = (id, nextProgress) => { const next = Math.max(0, Math.min(100, nextProgress)); setReadingProgress((current) => { const previous = current[id] || 0; if (next <= previous) return current; if (previous < 95 && next >= 95) showToast("读完一本！星图向前一步"); return { ...current, [id]: next }; }); };
  const openReader = (book) => { setDetailBook(null); setReaderBook(book); };
  const handleSearch = (value) => { setQuery(value); setVisibleCount(20); if (value.trim()) { setSelectedTheme("全部"); setActiveView("探索"); } };

  return <div className="app-shell"><aside className="sidebar"><Logo /><nav className="side-nav">{navItems.map((item) => <NavButton key={item.label} item={item} active={activeView === item.label} onClick={() => navigate(item.label)} />)}</nav><div className="source-card"><ShieldCheck size={23} weight="fill" /><span><strong>免费公版原著</strong><small>来源可追溯 · 完整正文</small></span></div></aside><main className="main-content"><header className="topbar"><div className="mobile-brand"><Logo /></div><div className="search-wrap"><MagnifyingGlass size={22} /><input value={query} onChange={(event) => handleSearch(event.target.value)} placeholder="搜索书名、作者、年龄或主题" aria-label={`搜索 ${books.length} 本读物`} />{query && <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label="清空搜索"><X size={17} /></button>}</div><div className="top-badge"><Leaf size={19} weight="fill" /><span><strong>{books.length} 本</strong><small>免费阅读</small></span></div></header>{activeView === "首页" && <HomeView savedBooks={savedBooks} readingProgress={readingProgress} completedBooks={completedBooks} onNavigate={navigate} onOpenBook={setDetailBook} onExplore={explore} />}{activeView === "探索" && <ExploreView selectedTheme={selectedTheme} setSelectedTheme={setSelectedTheme} filterLevel={filterLevel} setFilterLevel={setFilterLevel} filterAge={filterAge} setFilterAge={setFilterAge} filteredBooks={filteredBooks} visibleCount={visibleCount} setVisibleCount={setVisibleCount} savedBooks={savedBooks} readingProgress={readingProgress} onOpenBook={setDetailBook} onToggleSaved={toggleSaved} onExplore={explore} />}{activeView === "我的书架" && <ShelfView savedBooks={savedBooks} readingProgress={readingProgress} onOpenBook={setDetailBook} onToggleSaved={toggleSaved} onNavigate={navigate} />}{activeView === "阅读足迹" && <TrailView completedBooks={completedBooks} readingProgress={readingProgress} onExplore={explore} onOpenBook={setDetailBook} />}{activeView === "好友" && <FriendsView identity={friendIdentity} setIdentity={setFriendIdentity} summary={friendSummary} showToast={showToast} />}<footer className="privacy-footer"><ShieldCheck size={16} weight="fill" /> 正文与原版图片来自 Project Gutenberg；AI 补图均明确标注。个人阅读详情保存在本机，好友功能仅同步昵称与汇总进度。</footer></main><nav className="mobile-nav">{navItems.map((item) => <NavButton key={item.label} item={item} compact active={activeView === item.label} onClick={() => navigate(item.label)} />)}</nav><BookDetail book={detailBook} saved={detailBook ? savedBooks.has(detailBook.id) : false} progress={detailBook ? readingProgress[detailBook.id] || 0 : 0} onClose={() => setDetailBook(null)} onToggleSaved={toggleSaved} onRead={openReader} />{readerBook && <Reader book={readerBook} progress={readingProgress[readerBook.id] || 0} onClose={() => setReaderBook(null)} onProgress={updateProgress} />}<div className={`toast ${toast ? "is-visible" : ""}`} role="status"><CheckCircle size={21} weight="fill" />{toast}</div></div>;
}
