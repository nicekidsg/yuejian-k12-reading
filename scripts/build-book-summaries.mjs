#!/usr/bin/env node
/**
 * Build a bilingual synopsis for every catalog item.
 *
 * Well-known single stories use a hand-checked plot summary. Collections and
 * less familiar titles use a transparent, metadata-based overview rather than
 * inventing plot details.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const booksPath = path.join(root, "src/data/gutenberg-books.json");
const outputPath = path.join(root, "src/data/book-summaries.json");
const books = JSON.parse(fs.readFileSync(booksPath, "utf8"));

const known = {
  12103: ["小女孩露茜在寻找丢失的手帕时，遇见了替小动物洗衣服、熨衣服的刺猬洗衣婆蒂吉·温克尔太太。一次温暖的山间拜访，让日常劳动变成了奇妙冒险。", "While looking for her missing handkerchiefs, Lucie meets Mrs. Tiggy-Winkle, a hedgehog washerwoman who launders and irons for the animals. An ordinary errand becomes a warm, magical visit in the hills."],
  14838: ["淘气的彼得兔不听妈妈劝告，偷偷闯进麦格先生的菜园。他在惊险逃跑中丢了衣服，也懂得了好奇心和规则都需要分寸。", "Mischievous Peter Rabbit ignores his mother's warning and sneaks into Mr. McGregor's garden. His breathless escape costs him his clothes and teaches a gentle lesson about curiosity, choices, and consequences."],
  14220: ["佛洛普西家的小兔子们在菜园里睡着，被麦格先生装进袋子。兔妈妈和朋友们机智合作，终于把孩子们安全救回家。", "The Flopsy Bunnies fall asleep in a garden and are gathered into a sack by Mr. McGregor. Mrs. Flopsy and her friends work together cleverly to bring the little rabbits safely home."],
  14407: ["本杰明兔带彼得回到菜园寻找丢失的衣服，却被一只猫困住。老本杰明及时出现，帮助两个小伙伴安全脱险。", "Benjamin Bunny takes Peter back to the garden to recover his lost clothes, but a cat traps them. Old Mr. Benjamin arrives just in time to help the young rabbits escape."],
  14797: ["松鼠蒂米和妻子忙着储存坚果，却因误会和争抢被卷进麻烦。蒂米被困在树洞后，在朋友帮助下回到家。", "Timmy Tiptoes and his wife gather nuts for winter, but suspicion and squabbling lead to trouble. After Timmy is trapped inside a hollow tree, friendship helps him find his way home."],
  14814: ["想自己孵蛋的杰迈玛鸭太太被狡猾狐狸骗到树林里。牧羊犬凯普识破危险，及时救下了她。", "Jemima Puddle-Duck wants a quiet place to hatch her eggs, but a sly fox lures her into the woods. Kep the sheepdog recognizes the danger and comes to her rescue."],
  14837: ["汤姆小猫和妹妹们穿上新衣服招待客人，却在玩耍中把衣服弄乱，还让鸭子们穿走了。故事用幽默展现孩子气的淘气与混乱。", "Tom Kitten and his sisters dress up for visitors, but their play soon ruins the neat clothes and sends them floating away with the ducks. The story turns childish mischief into warm comedy."],
  14848: ["小猫莫佩特假装没看见老鼠，想趁机把它捉住；机灵的老鼠却找到机会逃走。这个短故事是一场轻快的猫鼠游戏。", "Miss Moppet pretends not to see a mouse so she can catch it by surprise, but the clever mouse finds a chance to escape. The tiny tale plays out as a lively game of cat and mouse."],
  14868: ["格洛斯特的老裁缝病倒后，担心无法完成市长的华丽礼服。曾被他救下的小老鼠们连夜帮忙，让善意得到温柔回报。", "When the old Tailor of Gloucester falls ill, he fears he cannot finish the mayor's magnificent coat. The mice he once protected work through the night, returning his kindness with a small miracle."],
  14872: ["顽皮的松鼠纳特金用谜语和无礼挑战老猫头鹰布朗，最后因太过放肆付出代价。这是一则关于礼貌与分寸的幽默动物故事。", "Squirrel Nutkin teases Old Brown the owl with riddles and rude tricks until his boldness goes too far. This humorous animal tale explores manners, courage, and the cost of ignoring boundaries."],
  15077: ["青蛙杰里米先生去池塘钓鱼，途中遇到甲虫、鱼和大鳟鱼，差点成为别人的午餐。他空手回家，却仍和朋友们享用了愉快晚餐。", "Mr. Jeremy Fisher goes fishing and meets beetles, minnows, and one enormous trout that nearly makes a meal of him. He returns without a catch, but still shares a cheerful supper with friends."],
  18155: ["三只小猪分别用稻草、木头和砖盖房子。大灰狼吹倒前两座房子，却无法战胜坚固的砖房，故事赞美准备、耐心与智慧。", "Three little pigs build houses of straw, sticks, and brick. A wolf blows down the first two homes but cannot defeat the sturdy brick house, celebrating preparation, patience, and clever thinking."],
  19772: ["三只小熊离家散步时，金发姑娘闯进屋里，尝粥、坐椅子、睡小床。小熊们回来后发现陌生访客，故事在重复句式中讲述边界与尊重。", "While three bears are out walking, Goldilocks enters their home, tastes their porridge, tries their chairs, and sleeps in a bed. The repeating pattern introduces ideas about boundaries and respect."],
  11757: ["一只玩具兔渴望变成真正的兔子。经过小男孩长久的爱与陪伴，它明白“真实”来自被真心爱过，并迎来温柔的改变。", "A toy rabbit longs to become real. Through a child's lasting love and companionship, the rabbit learns that being real grows from being truly loved, leading to a tender transformation."],
  18343: ["哈默林城请神秘的吹笛人赶走老鼠，却在事成后拒绝兑现承诺。吹笛人于是用音乐带走孩子们，提醒读者诚信的重要。", "The town of Hamelin hires a mysterious piper to remove its rats, then refuses to keep its promise. His music brings a grave consequence, making the poem a memorable warning about honesty."],
  55: ["多萝西被旋风带到奥兹国，与稻草人、铁皮人和胆小狮结伴寻找魔法师。一路的考验让他们发现，智慧、爱心和勇气其实早已在自己心中。", "Dorothy is swept to Oz and joins the Scarecrow, Tin Woodman, and Cowardly Lion on a journey to the Wizard. Their trials reveal that wisdom, love, courage, and the way home were closer than they imagined."],
  54: ["男孩蒂普和南瓜头杰克逃离女巫莫姆比，卷入奥兹国王位之争。他们与稻草人、铁皮人等伙伴同行，也发现了蒂普身世的秘密。", "Tip and Jack Pumpkinhead escape the witch Mombi and become caught in a struggle for the throne of Oz. With the Scarecrow, Tin Woodman, and new friends, Tip also uncovers the secret of his own identity."],
  289: ["鼹鼠、河鼠、獾和冲动的蟾蜍先生在河岸与野树林间生活。友情帮助他们面对诱惑、麻烦和家园危机，也让四季的自然充满诗意。", "Mole, Rat, Badger, and impulsive Mr. Toad share adventures along the riverbank and in the Wild Wood. Friendship helps them face temptation, trouble, and threats to home amid a richly changing natural world."],
  21588: ["一个不爱争斗、只爱诗歌与故事的龙遇见了圣乔治。小男孩帮助双方理解彼此，用聪明的办法化解了原本注定的战斗。", "A peaceful dragon who loves poetry meets Saint George, who is expected to fight him. A thoughtful boy helps them understand one another and invent a clever, nonviolent answer to the conflict."],
  2781: ["吉卜林用充满想象的“起源故事”解释豹子为何有斑点、骆驼为何有驼峰等自然谜题。夸张、重复和语言游戏让每篇故事都适合朗读。", "Kipling's playful origin tales explain how the leopard got its spots, how the camel got its hump, and other natural mysteries. Exaggeration, repetition, and wordplay make the stories especially enjoyable aloud."],
  501: ["能听懂动物语言的杜立德医生离开人类病人，在动物朋友帮助下远赴非洲救治生病的猴子。善良、好奇与跨物种友谊贯穿旅程。", "Doctor Dolittle can speak with animals and leaves his human practice to help sick monkeys in Africa. Kindness, curiosity, and friendship across species guide his remarkable voyage."],
  500: ["木偶匹诺曹渴望成为真正的男孩，却常因冲动和谎言陷入危险。一次次选择与补救，让他逐渐理解诚实、责任和爱。", "Pinocchio longs to become a real boy but repeatedly falls into danger through impulsive choices and lies. Each mistake and act of repair helps him understand honesty, responsibility, and love."],
  11: ["爱丽丝追着白兔掉进兔子洞，来到充满会说话动物、古怪规则和文字游戏的仙境。她在不断变大变小的冒险中努力保持好奇与自我。", "Alice follows a White Rabbit down a hole into a world of talking animals, puzzling rules, and playful language. Through constant changes and strange encounters, she tries to keep hold of curiosity and identity."],
  12: ["爱丽丝穿过镜子进入一座像棋盘一样的世界，遇见红后、白骑士和双胞胎等奇特角色。她一步步前进，努力从小卒成为王后。", "Alice steps through a looking-glass into a chessboard world of queens, knights, and curious twins. Moving square by square, she tries to advance from pawn to queen while making sense of dreamlike rules."],
  708: ["艾琳公主在山中城堡发现神秘的曾曾祖母，并与矿工男孩柯迪相识。当地精灵计划发动袭击，两个孩子用勇气和信任守护家园。", "Princess Irene discovers a mysterious great-great-grandmother in her mountain castle and befriends Curdie, a miner's son. When goblins plot an attack, courage and trust help the children protect their home."],
  902: ["这部童话集以《快乐王子》为核心：王子雕像和小燕子把宝石与金箔送给穷人。多个故事用诗意想象讨论同情、牺牲与真正的美。", "This collection centers on the Happy Prince, whose statue gives its jewels and gold to people in need with the help of a swallow. Its lyrical tales explore compassion, sacrifice, and the meaning of beauty."],
  770: ["巴斯特布尔家的孩子们想出各种办法寻找财富，希望改善家中的困境。计划常常出错，却展现了兄弟姐妹间的忠诚、想象力和幽默。", "The Bastable children try one imaginative scheme after another to restore their family's fortune. Their plans often go wrong, but reveal loyalty, resourcefulness, and affectionate sibling humor."],
  778: ["五个孩子在沙坑里发现能实现愿望的沙仙。每天的愿望听起来很美好，却总带来意外麻烦，孩子们因此学会谨慎思考。", "Five children discover a sand-fairy that grants one wish each day. Every exciting wish brings an unexpected complication, teaching them to think carefully about what they ask for."],
  1874: ["三个孩子随母亲搬到铁路旁的小屋，父亲的离开成了家中秘密。他们与车站的人们建立友谊，并用勇气和善意帮助家人与陌生人。", "Three children move with their mother to a cottage beside the railway while their father's absence remains a family mystery. Friendship, courage, and kindness help them aid both strangers and their own family."],
  113: ["孤僻的玛丽来到舅舅的庄园，发现一座被锁了多年的秘密花园。她与柯林、迪肯一起让花园复苏，也让自己的身体和心灵重新成长。", "Lonely Mary arrives at her uncle's manor and discovers a garden locked for years. With Colin and Dickon, she brings it back to life and begins a healing transformation of body, friendship, and spirit."],
  146: ["富有想象力的萨拉在寄宿学校从备受优待跌入贫困。即使身处困境，她仍坚持善良与尊严，并在意外帮助下重获温暖生活。", "Imaginative Sara falls from privilege into poverty at her boarding school. Even in hardship she protects her kindness and dignity, until unexpected help brings warmth and justice back into her life."],
  514: ["马奇家四姐妹在战争年代共同成长，各自面对梦想、家庭责任、友情和失去。她们性格不同，却在爱与挫折中找到自己的道路。", "The four March sisters grow up during wartime, balancing dreams, family duties, friendship, and loss. Their different personalities lead them along separate paths, held together by love and resilience."],
  45: ["想象力丰富的孤儿安妮意外来到绿山墙农舍。她用热情、错误和真诚改变了身边的人，也慢慢在爱德华王子岛找到归属。", "Imaginative orphan Anne arrives at Green Gables by mistake. Her enthusiasm, mishaps, and sincerity transform the people around her as she gradually finds belonging on Prince Edward Island."],
  47: ["长大一些的安妮成为阿冯利学校的老师，一边承担责任，一边继续学习、交友和追求梦想。社区生活让她在理想与现实之间更加成熟。", "A little older, Anne becomes Avonlea's schoolteacher while continuing to learn, form friendships, and pursue her dreams. Community responsibilities help her grow between youthful ideals and everyday reality."],
  1448: ["孤儿海蒂来到阿尔卑斯山与爷爷生活，并深深爱上山野与朋友彼得。后来城市生活让她思念家乡，而她的真诚也给克拉拉和周围人带来希望。", "Orphaned Heidi goes to live with her grandfather in the Alps and grows to love the mountains and her friend Peter. City life later makes her homesick, while her warmth brings hope to Clara and everyone around her."],
  236: ["在人类村庄长大的狼孩毛克利，在巴鲁、巴希拉等动物朋友帮助下学习丛林法则，并面对老虎谢尔汗。书中其他故事也展现野性、忠诚与生存。", "Mowgli, a human child raised by wolves, learns the Law of the Jungle from Baloo, Bagheera, and other animal friends while facing Shere Khan. Other tales explore wilderness, loyalty, and survival."],
  16: ["彼得·潘带温迪和弟弟们飞往永无岛，那里有迷失男孩、仙女、人鱼和虎克船长。冒险让孩子们思考成长、家庭与永远不长大的代价。", "Peter Pan takes Wendy and her brothers to Neverland, home to Lost Boys, fairies, mermaids, and Captain Hook. Their adventure explores family, growing up, and the cost of never growing older."],
  271: ["黑骏马以自己的视角讲述从温暖农场到不同主人手中的一生。它经历善意与苛待，让读者理解动物感受、责任与同情。", "Black Beauty tells his own life story as he passes from a loving farm through the hands of many owners. Experiences of kindness and cruelty invite readers to consider animal welfare, responsibility, and empathy."],
  120: ["少年吉姆发现一张藏宝图，与伙伴们乘船寻找海盗宝藏。航程中的背叛、勇气和约翰·西尔弗的复杂选择，让冒险充满悬念。", "Young Jim discovers a treasure map and sails in search of pirate gold. Mutiny, courage, and the complicated choices of Long John Silver turn the voyage into a tense coming-of-age adventure."],
  103: ["福克先生为证明一次豪赌，带着仆人路路通在八十天内环游世界。交通意外、追捕和文化见闻不断考验时间，也改变了他的人生。", "Phileas Fogg wagers that he can travel around the world in eighty days. Delays, pursuit, and unexpected encounters test the clock while quietly changing the reserved traveler himself."],
  521: ["鲁滨逊遭遇海难后独自在荒岛生活多年。他用劳动与创造力建立住处、获取食物，并在遇见星期五后重新思考孤独与伙伴关系。", "After a shipwreck, Robinson Crusoe survives alone on an island for years. Work and ingenuity help him build a life, while meeting Friday changes his experience of isolation and companionship."],
  11703: ["一家人在海难后流落荒岛，利用有限物资搭建住所、种植食物并探索自然。共同解决问题让这场求生经历成为家庭协作的冒险。", "A family is shipwrecked on an island and uses limited supplies to build shelter, grow food, and explore nature. Solving problems together turns survival into an adventure in family cooperation."],
  139: ["记者马龙参加一支探险队，深入与世隔绝的高原，发现史前生物仍在那里生存。科学争论、危险和惊奇推动这场失落世界之旅。", "Reporter Malone joins an expedition to an isolated plateau where prehistoric creatures still survive. Scientific rivalry, danger, and wonder drive their journey through the lost world."],
  1661: ["华生记录福尔摩斯凭观察、推理和证据破解的一组案件。每个谜题都邀请读者注意细节，并理解表象背后可能隐藏的真相。", "Watson records a set of cases solved by Sherlock Holmes through observation, reasoning, and evidence. Each mystery invites readers to notice details and look beyond appearances."],
  215: ["雪橇犬巴克被带到北方荒野，在严酷环境中学习生存与领导。人与动物的关系、力量和内心的野性共同推动它的改变。", "Buck is taken from a comfortable home to the northern wilderness, where he learns survival and leadership as a sled dog. Hardship, human bonds, and an inner wildness shape his transformation."],
  910: ["白牙是一只带有狼血统的犬，在荒野与人类世界间经历恐惧、暴力和信任。耐心的善意最终帮助它学会亲近与归属。", "White Fang, a wolf-dog, moves between wilderness and the human world through fear, violence, and slowly earned trust. Patient kindness eventually teaches him affection and belonging."],
  35: ["一位时间旅行者来到遥远未来，遇见地表的埃洛伊人和地下的莫洛克人。冒险把科学想象与对社会发展方向的追问结合起来。", "A Time Traveller journeys far into the future and discovers the surface-dwelling Eloi and underground Morlocks. The adventure combines scientific imagination with questions about the direction of society."],
  36: ["火星人突然入侵英国，强大的机器让人类社会陷入混乱。叙述者在逃亡中观察恐惧、求生与文明的脆弱。", "Martians invade England with machines far beyond human power, throwing society into chaos. As the narrator struggles to survive, the story examines fear, endurance, and the fragility of civilization."],
  74: ["汤姆·索亚在密西西比河边小镇长大，逃课、探险、目击犯罪并寻找宝藏。淘气背后，他也在关键时刻学会勇敢和担当。", "Tom Sawyer grows up in a Mississippi River town, skipping school, exploring, witnessing a crime, and hunting treasure. Beneath the mischief, he learns courage and responsibility when they matter most."],
  46: ["吝啬冷漠的斯克鲁奇在圣诞夜被三位幽灵带去看过去、现在与未来。那些景象促使他重新理解善意、家庭与分享。", "Cold and miserly Scrooge is visited on Christmas Eve by spirits of the past, present, and future. What they reveal changes his understanding of kindness, family, and generosity."],
};

function isCollection(book) {
  return /(collection|tales|stories|rhymes|poems|poetry|fables|mother goose|fairy book|treasury|bouquet|opera|garden of verses)/i.test(
    `${book.title} ${book.contentType || ""}`,
  );
}

function fallback(book) {
  const title = `《${book.title}》`;
  const enTitle = `“${book.title}”`;
  if (isCollection(book)) {
    return [
      `${title}是一部${book.contentType || "经典儿童故事"}合集，以多个短篇、韵文或传统故事带孩子认识不同角色与情境。适合分次阅读，也适合亲子朗读后讨论最喜欢的篇章。`,
      `${enTitle} is a collection of ${book.contentType || "classic writing for young readers"}, bringing together short tales, verse, or traditional narratives with varied characters and settings. It works well for reading in small portions and discussing favorite pieces together.`,
    ];
  }
  const byTheme = {
    animals: [
      `${title}围绕动物角色与自然环境展开，在相遇、选择和小小危机中表现友谊、机智与成长。孩子可以跟随主角观察动物行为，也思考怎样与伙伴相处。`,
      `${enTitle} follows animal characters through encounters, choices, and manageable dangers in the natural world. Friendship, resourcefulness, and growth invite young readers to notice animal behavior and think about caring for others.`,
    ],
    fantasy: [
      `${title}把主人公带入充满奇异角色和意外规则的想象世界。一次次挑战推动旅程向前，也让勇气、善意与解决问题的能力逐渐显现。`,
      `${enTitle} carries its characters into an imaginative world of unusual beings and unexpected rules. A sequence of challenges moves the journey forward while revealing courage, kindness, and problem-solving.`,
    ],
    adventure: [
      `${title}讲述主人公离开熟悉环境、面对未知与困难的冒险。旅途中既有危险和选择，也有伙伴、发现与逐渐增长的责任感。`,
      `${enTitle} sends its characters beyond familiar surroundings to face uncertainty and difficulty. Danger and hard choices are balanced by companionship, discovery, and a growing sense of responsibility.`,
    ],
    growth: [
      `${title}以家庭、学校或社区生活为背景，记录主人公在人际关系与日常挑战中的变化。故事关注理解他人、承担责任和找到自我位置。`,
      `${enTitle} is rooted in family, school, or community life and follows its characters through relationships and everyday challenges. The story focuses on understanding others, taking responsibility, and finding one's place.`,
    ],
    world: [
      `${title}通过不同地域或时代的角色与经历，带读者走进更广阔的世界。故事把文化见闻与人物选择结合起来，鼓励好奇、理解和独立思考。`,
      `${enTitle} opens a window onto characters and experiences from another place or time. Cultural discovery and personal choices encourage curiosity, understanding, and independent thought.`,
    ],
  };
  return byTheme[book.themeId] || byTheme.growth;
}

const summaries = {};
for (const book of books) {
  const [zh, en] = known[book.gutenbergId] || fallback(book);
  summaries[book.gutenbergId] = { zh, en };
}

if (Object.keys(summaries).length !== books.length) {
  throw new Error(`Expected ${books.length} summaries, got ${Object.keys(summaries).length}`);
}
for (const book of books) {
  const item = summaries[book.gutenbergId];
  if (!item?.zh || !item?.en || item.zh.length < 30 || item.en.length < 80) {
    throw new Error(`Synopsis too short for ${book.gutenbergId} ${book.title}`);
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
console.log(
  `Built ${books.length} bilingual summaries: ${Object.keys(known).length} plot-specific, ` +
  `${books.length - Object.keys(known).length} metadata-based collection/theme overviews.`,
);
