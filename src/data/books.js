import gutenbergBooks from "./gutenberg-books.json";
import librivoxAudiobooks from "./librivox-audiobooks.json";

export const categories = [
  { id: "fantasy", name: "奇幻童话", tone: "purple", description: "魔法、想象与经典童话" },
  { id: "adventure", name: "冒险探索", tone: "blue", description: "航海、寻宝与勇敢出发" },
  { id: "animals", name: "动物自然", tone: "mint", description: "动物伙伴与自然世界" },
  { id: "growth", name: "成长伙伴", tone: "green", description: "友谊、家庭与自我成长" },
  { id: "world", name: "世界故事", tone: "cyan", description: "来自不同文化的经典故事" },
];

export const ageFilters = [
  { id: "4-7", label: "4–7 岁" },
  { id: "7-9", label: "7–9 岁" },
  { id: "9-12", label: "9–12 岁" },
  { id: "12+", label: "12 岁以上" },
];

const descriptions = Object.fromEntries(categories.map((category) => [category.id, category.description]));

function recommendedAge(wordCount) {
  if (wordCount < 12_000) return "7–10 岁";
  if (wordCount < 30_000) return "8–12 岁";
  if (wordCount < 60_000) return "9–13 岁";
  if (wordCount < 100_000) return "10–14 岁";
  return "12–16 岁";
}

function ageGroupFor(ageRange) {
  const startAge = Number.parseInt(ageRange, 10);
  if (startAge <= 4) return "4-7";
  if (startAge <= 8) return "7-9";
  if (startAge <= 10) return "9-12";
  return "12+";
}

export const books = gutenbergBooks.map((book) => {
  const ageRange = book.ageRange || recommendedAge(book.wordCount);
  const originalIllustrations = book.originalIllustrations || [];
  const aiIllustrations = book.aiIllustrations || [];
  const illustrations = [
    book.cover,
    ...originalIllustrations,
    ...aiIllustrations,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  return {
    ...book,
    textPath: book.textPath.replace(/\.gz$/, ""),
    vocabularyPath: `/vocabulary/${book.gutenbergId}.json`,
    audiobook: librivoxAudiobooks[book.gutenbergId] || null,
    ageRange,
    ageGroup: ageGroupFor(ageRange),
    originalIllustrations,
    aiIllustrations,
    illustrations,
    description: book.recommendation
      ? `${book.recommendation}。完整英文原文来自 Project Gutenberg，可直接在线阅读。`
      : `${descriptions[book.themeId]}。完整英文原文来自 Project Gutenberg，可直接在线阅读。`,
    lexile: "平台估算",
    tags: [
      book.category,
      book.secondaryCategory,
      book.contentType,
      book.level,
      book.grade,
      book.author,
    ].filter(Boolean),
  };
});

export const featuredBooks = categories.map((category) =>
  books.find((book) => book.themeId === category.id),
);

export const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
