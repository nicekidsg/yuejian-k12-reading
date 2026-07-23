import assert from "node:assert/strict";
import { contextualizeVocabularyEntry } from "../src/vocabulary-context.js";

const peterVerb = {
  word: "peter",
  phonetic: "'pi:tə",
  translation: "vi. 逐渐消失, 逐渐减少",
  definition: "n. disciple of Jesus and leader of the Apostles",
  pos: "vi. 不及物动词",
  level: "基础巩固",
};

const properPeter = contextualizeVocabularyEntry(
  peterVerb,
  'Author of "The Tale of Peter Rabbit," etc.',
  "Peter",
);
assert.equal(properPeter.displayWord, "Peter");
assert.equal(properPeter.lookupWord, "peter");
assert.equal(properPeter.pos, "n. 专有名词");
assert.match(properPeter.translation, /彼得.*小兔彼得/);
assert.doesNotMatch(properPeter.translation, /逐渐/);
assert.equal(properPeter.authorityLinks.length, 1);
assert.doesNotMatch(properPeter.authorityLinks[0].url, /\/peter$/);

const lowerCaseVerb = contextualizeVocabularyEntry(
  peterVerb,
  "The stream will peter out before summer.",
  "peter",
);
assert.equal(lowerCaseVerb.pos, "vi. 不及物动词");
assert.match(lowerCaseVerb.translation, /逐渐/);
assert.deepEqual(lowerCaseVerb.authorityLinks.map((source) => source.label), [
  "剑桥英汉",
  "柯林斯英汉",
  "韦氏学生词典",
]);

const commonWord = contextualizeVocabularyEntry(
  { ...peterVerb, word: "nice", translation: "adj. 美好的", pos: "adj. 形容词" },
  "Nice weather makes us smile.",
  "Nice",
);
assert.equal(commonWord.pos, "adj. 形容词");

const titleNoun = contextualizeVocabularyEntry(
  { ...peterVerb, word: "rabbit", translation: "n. 兔子", pos: "n. 名词" },
  "The Tale of Peter Rabbit",
  "Rabbit",
);
assert.equal(titleNoun.pos, "n. 名词");

const unknownCharacter = contextualizeVocabularyEntry(
  { ...peterVerb, word: "moppet" },
  "The Story of Miss Moppet",
  "Moppet",
);
assert.equal(unknownCharacter.pos, "n. 专有名词");
assert.match(unknownCharacter.translation, /专有名称/);

console.log("vocabulary context passed: proper names, common words, and authority links");
