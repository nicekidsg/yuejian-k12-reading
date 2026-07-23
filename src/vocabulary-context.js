const CHILD_NAME_GLOSSES = {
  alice: "爱丽丝（人名）",
  beatrix: "碧雅翠丝（人名）",
  benjamin: "本杰明（人名）",
  dorothy: "多萝西（人名）",
  frederick: "弗雷德里克（人名）",
  jack: "杰克（人名）",
  jemima: "杰迈玛（人名）",
  john: "约翰（人名）",
  lucie: "露西（人名）",
  lucy: "露西（人名）",
  mary: "玛丽（人名）",
  peter: "彼得（人名）",
  robin: "罗宾（人名）",
  sally: "莎莉（人名）",
  samuel: "塞缪尔（人名）",
  thomas: "托马斯（人名）",
  tom: "汤姆（人名）",
  warne: "沃恩（姓氏）",
  wendy: "温迪（人名）",
  william: "威廉（人名）",
};

const COMMON_TITLE_WORDS = new Set([
  "author", "book", "chapter", "contents", "copyright", "edition", "end",
  "first", "illustration", "illustrations", "introduction", "king", "lady",
  "little", "miss", "mother", "mr", "mrs", "part", "preface", "published",
  "queen", "rabbit", "story", "tale", "the",
]);

const HONORIFICS = new Set(["aunt", "captain", "doctor", "dr", "lady", "lord", "master", "miss", "mr", "mrs", "professor", "sir", "uncle"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCapitalizedToken(token) {
  return /^[A-Z][a-z]+(?:['’][A-Za-z]+)?$/.test(token) || /^[A-Z]{2,}$/.test(token);
}

function occurrencesForWord(pageText, word) {
  return pageText.match(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi")) || [];
}

function hasNameContext(pageText, token) {
  const escaped = escapeRegExp(token);
  const pairedName = new RegExp(`(?:\\b[A-Z][a-z]+\\s+${escaped}\\b|\\b${escaped}\\s+[A-Z][a-z]+\\b)`);
  const honorificName = new RegExp(`\\b(${[...HONORIFICS].join("|")})\\.?\\s+${escaped}\\b`, "i");
  return pairedName.test(pageText) || honorificName.test(pageText);
}

function properNameGloss(word, pageText) {
  const base = CHILD_NAME_GLOSSES[word];
  if (word === "peter" && /\bPeter\s+Rabbit\b/.test(pageText)) {
    return "彼得（人名；Peter Rabbit 指“小兔彼得”）";
  }
  return base || "本页中的专有名称（人名、角色名或地名）";
}

function properNameDefinition(word, pageText) {
  if (word === "peter" && /\bPeter\s+Rabbit\b/.test(pageText)) {
    return "a male given name; here, Peter Rabbit is the name of the story character";
  }
  return "a proper name used for a specific person, character, or place in this story";
}

export function sentenceForWord(text, word) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const matcher = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  const sentence = sentences.find((item) => matcher.test(item)) || "";
  return sentence.length > 170 ? `${sentence.slice(0, 167).trim()}…` : sentence.trim();
}

export function authoritySourcesForWord(word, isProperName = false) {
  if (isProperName) {
    return [{
      label: "柯林斯英汉：人名用法",
      url: "https://www.collinsdictionary.com/dictionary/english-chinese/name",
    }];
  }
  const encoded = encodeURIComponent(word.toLowerCase());
  return [
    {
      label: "剑桥英汉",
      url: `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${encoded}`,
    },
    {
      label: "柯林斯英汉",
      url: `https://www.collinsdictionary.com/dictionary/english-chinese/${encoded}`,
    },
    {
      label: "韦氏学生词典",
      url: "https://www.merriam-webster.com/kids",
    },
  ];
}

export function contextualizeVocabularyEntry(entry, pageText, matchedToken) {
  const lookupWord = entry.word.toLowerCase().replace("’", "'");
  const occurrences = occurrencesForWord(pageText, lookupWord);
  const allOccurrencesCapitalized = occurrences.length > 0 && occurrences.every(isCapitalizedToken);
  const knownChildName = Boolean(CHILD_NAME_GLOSSES[lookupWord]);
  const contextualProperName = isCapitalizedToken(matchedToken)
    && !COMMON_TITLE_WORDS.has(lookupWord)
    && allOccurrencesCapitalized
    && (knownChildName || hasNameContext(pageText, matchedToken));

  if (!contextualProperName) {
    return {
      ...entry,
      lookupWord,
      displayWord: matchedToken,
      sourceLabel: "ECDICT 开放英汉词典",
      authorityLinks: authoritySourcesForWord(lookupWord),
    };
  }

  return {
    ...entry,
    word: lookupWord,
    lookupWord,
    displayWord: matchedToken,
    translation: properNameGloss(lookupWord, pageText),
    definition: properNameDefinition(lookupWord, pageText),
    pos: "n. 专有名词",
    level: "语境识别",
    sourceLabel: "阅见少儿语境词库 · 本书上下文",
    authorityLinks: authoritySourcesForWord(lookupWord, true),
  };
}
