import { z } from "zod";

// ---- 語言 ----
export const LANGUAGES = ["zh", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: "中文",
  en: "English",
};

// ---- 年齡層：控制用字與句型（長度改由 STORY_LENGTHS 控制）----
export const AGE_BANDS = ["2-4", "4-6", "6-8", "8-10"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export interface AgeRule {
  label: string;
  style: string;
  /** 閱讀頁字級（Tailwind class） */
  fontClass: string;
}

export const AGE_RULES: Record<AgeBand, AgeRule> = {
  "2-4": {
    label: "2–4 歲",
    style:
      "Very short sentences: in Chinese at most about 10 characters, in English at most about 8 words. Reach the length with more sentences and repetition, never by making sentences longer. Repetitive patterns and onomatopoeia. Gentle rhymes are welcome. One simple idea, no conflict, cozy ending.",
    fontClass: "text-2xl leading-relaxed",
  },
  "4-6": {
    label: "4–6 歲",
    style:
      "Short sentences: in Chinese at most about 15 characters, in English at most about 10 words. Reach the length with more events, not longer sentences. Everyday vocabulary plus 2–3 slightly new words made clear by context. Simple cause and effect. A tiny problem that is solved kindly. Warm ending.",
    fontClass: "text-xl leading-relaxed",
  },
  "6-8": {
    label: "6–8 歲",
    style:
      "Medium sentences, some new words made clear by context (never define them outright). A small challenge, a turning point, and a gentle lesson that is shown, not lectured.",
    fontClass: "text-lg leading-relaxed",
  },
  "8-10": {
    label: "8–10 歲",
    style:
      "Rich, precise vocabulary that stretches a 9-year-old: vivid verbs, a few less common words made clear by context, and in Chinese some fitting idioms (成語). Mix short punchy sentences with longer ones. A clear plot with a surprise the reader discovers (never announce it as 'the twist' or 'the surprise' in the text), light humor, and a character who grows.",
    fontClass: "text-base leading-relaxed",
  },
};

/** 主角年齡 → 年齡層。主角年齡是唯一輸入，前後端都用這個換算 */
export function ageBandFor(age: number): AgeBand {
  if (age <= 3) return "2-4";
  if (age <= 5) return "4-6";
  if (age <= 7) return "6-8";
  return "8-10";
}

// ---- 故事風格 ----
export const STORY_STYLES = ["adventure", "inspiring", "cute", "bedtime", "fable"] as const;
export type StoryStyle = (typeof STORY_STYLES)[number];

/** 年齡層合起來的範圍，例如 ["2-4","4-6"] → 「2–6 歲」 */
export function ageRangeLabel(bands: readonly AgeBand[]): string {
  const sorted = [...bands].sort((a, b) => AGE_BANDS.indexOf(a) - AGE_BANDS.indexOf(b));
  const from = sorted[0].split("-")[0];
  const to = sorted[sorted.length - 1].split("-")[1];
  return `${from}–${to} 歲`;
}

export const STYLE_RULES: Record<StoryStyle, { label: string; hint: string; prompt: string }> = {
  adventure: {
    label: "冒險",
    hint: "出發去探險",
    prompt: "An adventure: a small journey or quest with discovery and excitement, resolved safely.",
  },
  inspiring: {
    label: "勵志",
    hint: "學會勇敢",
    prompt:
      "An encouraging story: the hero tries something hard, struggles a little, and grows through effort or kindness. Show the growth through actions.",
  },
  cute: {
    label: "可愛",
    hint: "軟軟萌萌",
    prompt: "A cute, playful story: gentle humor, small funny moments, soft and cheerful mood.",
  },
  bedtime: {
    label: "晚安",
    hint: "安靜好入睡",
    prompt:
      "A calm bedtime story: slow pace, soothing repetition, low excitement, the world gradually getting quiet and sleepy. A slow pace means more gentle sensory detail (sounds, warmth, soft light), not fewer words: still reach the requested length.",
  },
  fable: {
    label: "寓言",
    hint: "小故事大道理",
    prompt:
      "A fable: animal or nature characters face a simple choice, and what happens because of that choice carries one clear wisdom. Let the meaning land through the ending and the characters' own words or actions, so a child can say what it means; never add a narrator moral or 'the lesson is'. The hero is part of the story, as a friend, helper or the one who chooses.",
  },
};

// ---- 故事長度：以朗讀時間換算字數（中文以字計，英文以 word 計）----
// 同樣的朗讀時間，年紀越小念得越慢、篇幅也該越短；所以字數依年齡層設定。
// 依據：docs/eval 品質測試（2026-10-13 v3），全年齡共用一組字數時，2–4 歲寫不到下限、8–10 歲情節被壓淺。
export const STORY_LENGTHS = ["3min", "10min"] as const;
export type StoryLength = (typeof STORY_LENGTHS)[number];

type WordRange = readonly [number, number];

export const LENGTH_RULES: Record<
  StoryLength,
  { label: string; words: Record<AgeBand, Record<Language, WordRange>> }
> = {
  "3min": {
    label: "3 分鐘",
    words: {
      "2-4": { zh: [250, 400], en: [150, 250] },
      "4-6": { zh: [400, 550], en: [250, 350] },
      "6-8": { zh: [500, 700], en: [300, 420] },
      "8-10": { zh: [600, 800], en: [380, 500] },
    },
  },
  "10min": {
    label: "10 分鐘",
    words: {
      "2-4": { zh: [550, 800], en: [500, 700] },
      "4-6": { zh: [900, 1200], en: [750, 1000] },
      "6-8": { zh: [1700, 2200], en: [1000, 1300] },
      "8-10": { zh: [1900, 2400], en: [1150, 1450] },
    },
  },
};

/** 依 LENGTH_RULES 的算法計算故事長度：中文算漢字（不含標點），英文算 word */
export function storyLength(paragraphs: readonly string[], language: Language): number {
  const text = paragraphs.join("\n");
  if (language === "zh") return (text.match(/\p{Script=Han}/gu) ?? []).length;
  return text.split(/\s+/).filter(Boolean).length;
}

// ---- 主角（只存在裝置上，送到 API 只用於這一次生成）----
export const GENDERS = ["boy", "girl", "unspecified"] as const;
export type Gender = (typeof GENDERS)[number];

/** 只允許文字、數字、空白與少數標點，降低提示詞注入的空間 */
const SAFE_TEXT = /^[\p{L}\p{N} ·・\-、，,]+$/u;

export const HeroSchema = z.object({
  name: z.string().trim().min(1).max(12).regex(SAFE_TEXT),
  age: z.number().int().min(2).max(10),
  gender: z.enum(GENDERS),
  likes: z.string().trim().max(30).regex(SAFE_TEXT).optional(),
});
export type Hero = z.infer<typeof HeroSchema>;

// ---- 故事場景：AI 從固定清單挑一個，前端依此換背景插畫 ----
export const STORY_SETTINGS = [
  "home",
  "park",
  "school",
  "zoo",
  "forest",
  "sea",
  "mountain",
  "city",
  "snow",
  "night_sky",
] as const;
export type StorySetting = (typeof STORY_SETTINGS)[number];

// ---- 主題：爸媽為了生活中的需要挑故事（安全、身體自主、生活習慣、情緒、品格） ----
export const THEME_CATEGORIES = {
  safety: { zh: "安全", en: "Safety" },
  body: { zh: "身體自主", en: "Body autonomy" },
  habits: { zh: "生活習慣", en: "Daily habits" },
  emotions: { zh: "情緒與人際", en: "Feelings & friends" },
  values: { zh: "品格", en: "Character" },
} as const satisfies Record<string, Record<Language, string>>;
export type ThemeCategory = keyof typeof THEME_CATEGORIES;
export const THEME_CATEGORY_IDS = Object.keys(THEME_CATEGORIES) as ThemeCategory[];

export interface ThemeRule {
  category: ThemeCategory;
  label: Record<Language, string>;
  ages: readonly AgeBand[];
  /** 故事一定要傳達的事（英文，給提示詞用）；故事用情節表現，引導卡才明講 */
  keyMessages: readonly string[];
  /** 敏感主題：生成時加上 SENSITIVE_THEME_GUARDRAILS，必須由專業人士審過才上架 */
  sensitive: boolean;
  /** 照片故事（即時 AI）能不能選這個主題；只開放生活習慣、情緒與品格 */
  aiAllowed: boolean;
  /** 第一批要做的主題 */
  priority: boolean;
}

const theme = (
  category: ThemeCategory,
  zh: string,
  en: string,
  ages: AgeBand[],
  keyMessages: string[],
  opts: { priority?: boolean; sensitive?: boolean; aiAllowed?: boolean } = {},
): ThemeRule => ({
  category,
  label: { zh, en },
  ages,
  keyMessages,
  sensitive: opts.sensitive ?? category === "body",
  aiAllowed: opts.aiAllowed ?? (category === "habits" || category === "emotions" || category === "values"),
  priority: opts.priority ?? false,
});

const P = { priority: true } as const;

export const THEMES = {
  // 安全
  "crossing-road": theme("safety", "過馬路", "Crossing the road", ["2-4", "4-6"], [
    "Always hold a grown-up's hand near the street and when crossing.",
    "Stop at the curb, look left, right and left again, and listen before crossing.",
    "Scooters and cars come fast and often, even on small lanes and in alleys, so we wait for the green walking light and keep watching while we cross.",
  ], P),
  "getting-lost": theme("safety", "走失了怎麼辦", "If I get lost", ["4-6", "6-8"], [
    "If you can't see your grown-up, stop and stay where you are; they will come back to look for you.",
    "Ask for help at a service counter or from a staff member in uniform, or a parent with children.",
    "Know your parent's name and phone number by heart so helpers can call them.",
  ], P),
  earthquake: theme("safety", "地震來了", "When the ground shakes", ["4-6", "6-8", "8-10"], [
    "When the ground shakes: drop down, cover your head and neck under a sturdy table, and hold on.",
    "Do not run outside or onto the stairs while it is shaking; stay away from windows and things that can fall.",
    "Listen to the grown-ups and teachers; after the shaking stops, they lead everyone out calmly.",
  ], P),
  strangers: theme("safety", "陌生人", "People we don't know", ["4-6", "6-8"], [
    "Never go anywhere with, or take snacks, toys or gifts from, someone your parents don't know, even if they seem nice.",
    "Most people are kind, but you only go with grown-ups your parents agreed on.",
    "If someone you don't know asks you to come along, say no loudly, go to your grown-up, and tell them.",
  ]),
  "hot-things": theme("safety", "燙燙的東西", "Hot things", ["2-4", "4-6"], [
    "Hot soup, the kettle, the stove and the rice cooker steam are only for grown-ups to touch.",
    "Wait until a grown-up says food has cooled down, and blow on it together.",
    "If something is hot, step back and call a grown-up.",
  ]),
  sockets: theme("safety", "插座不要碰", "Sockets and cords", ["2-4", "4-6"], [
    "Sockets and plugs are only for grown-ups; never poke fingers or objects into them.",
    "Keep water and wet hands away from plugs and cords.",
    "If a cord looks broken or a plug sparks, step away and tell a grown-up.",
  ]),
  "windows-balcony": theme("safety", "窗戶與陽台", "Windows and balconies", ["2-4", "4-6"], [
    "Never climb on a window ledge, balcony railing, or furniture pushed next to them.",
    "Look out of windows with your feet on the floor and a grown-up beside you.",
    "Balconies are for looking and plants, not for climbing games.",
  ]),
  "water-safety": theme("safety", "玩水安全", "Safe in the water", ["4-6", "6-8", "8-10"], [
    "Only play in water when a grown-up is watching you, at the pool, beach, or river.",
    "Wear a life jacket on boats and in open water, and stay where your feet can touch.",
    "If a friend is in trouble in the water, don't jump in: shout for a grown-up and throw something that floats.",
  ]),
  medicine: theme("safety", "藥不是糖果", "Medicine is not candy", ["2-4", "4-6"], [
    "Medicine and vitamins can look like candy, but they are not candy.",
    "You only take medicine when a grown-up gives it to you.",
    "If you find pills or bottles, don't taste them; bring a grown-up to see.",
  ]),
  typhoon: theme("safety", "颱風天", "Typhoon day", ["4-6", "6-8"], [
    "On a typhoon day we stay home and stay safe, away from windows during strong wind.",
    "Help the family get ready: flashlight, water, and bringing things in from the balcony.",
    "Do not go out to look at the wind, rivers or the sea; wait until grown-ups say it is safe.",
  ]),
  "online-safety": theme("safety", "網路安全", "Safe online", ["8-10"], [
    "Never share your photos, address, school, or phone number online.",
    "Online friends may not be who they say they are; never agree to meet them.",
    "If something online feels strange, scary, or asks you to keep a secret, stop and tell a trusted grown-up. You won't be in trouble.",
  ]),

  // 身體自主
  // 資料來源：
  // - NSPCC "PANTS / Underwear Rule"
  // - 勵馨基金會《小星與空空鳥》，標語「我的身體是我的，我的感覺很重要」
  // - 勵馨《祕密派對》（好祕密與壞祕密）
  // - 兒福聯盟 身體界線教材
  // - 衛福部統計：0–6 歲兒童受侵害案件，約九成加害者是孩子認識的人
  // Drafted from public guidance; must be reviewed by a child-protection professional before release.
  "swimsuit-rule": theme("body", "泳衣規則", "The swimsuit rule", ["2-4", "4-6", "6-8"], [
    "The parts your swimsuit covers are private and belong to you.",
    "Nobody should ask to see or touch them, or ask you to see or touch theirs.",
    "The only exception is staying clean or healthy: a parent helping with a bath, or a doctor checking you with your parent there and explaining why.",
  ], P),
  "good-bad-secrets": theme("body", "好祕密與壞祕密", "Good and bad secrets", ["4-6", "6-8", "8-10"], [
    "Surprises like a birthday gift are good secrets. They make everyone happy and end soon.",
    "A secret that makes you feel worried, scared or uncomfortable is not OK to keep. So is a secret someone says you must never tell.",
    "Tell a trusted adult. You will never be in trouble for telling.",
  ], P),
  "saying-no": theme("body", "我可以說不", "I can say no", ["2-4", "4-6", "6-8"], [
    "My body is mine, and my feelings matter.",
    "You can say no to hugs, kisses or tickles you don't want, even from family. You can offer a high five or a wave instead.",
    "Grown-ups should respect your no, and you respect other people's no too.",
  ], P),
  "trusted-adults": theme("body", "我的安全網", "My trusted grown-ups", ["4-6", "6-8", "8-10"], [
    "Pick a safety net of 3–5 trusted adults, and make at least one of them someone outside the family, such as a teacher or the school nurse.",
    "If the first adult doesn't listen, keep telling until someone helps.",
  ]),
  "not-your-fault": theme("body", "不是你的錯", "It's never your fault", ["6-8", "8-10"], [
    "If anyone ever makes you feel uncomfortable about your body, it is never your fault.",
    "That stays true even if you didn't say no, or kept it secret at first.",
    "Telling is brave, and keeping children safe is the grown-ups' job.",
  ]),

  // 生活習慣
  "brushing-teeth": theme("habits", "刷牙", "Brushing teeth", ["2-4", "4-6"], [
    "We brush our teeth every morning and every night before bed.",
    "Brush every tooth, front and back, gently in little circles, then a grown-up helps finish.",
    "Clean teeth keep the sugar bugs away and make smiles shine.",
  ], P),
  potty: theme("habits", "學上廁所", "Using the potty", ["2-4"], [
    "When your body tells you it needs to pee or poop, tell a grown-up and go to the potty.",
    "Accidents are OK and happen to everyone while learning; we just clean up and try again.",
    "Flush, then wash your hands with soap.",
  ], P),
  "starting-kindergarten": theme("habits", "上幼兒園", "Starting kindergarten", ["2-4", "4-6"], [
    "Mom or Dad always comes back at pick-up time.",
    "It's OK to feel nervous or cry at goodbye; teachers are there to help and comfort you.",
    "School has new friends, games and a routine you will get to know day by day.",
  ], P),
  "bedtime-routine": theme("habits", "睡前好習慣", "Bedtime routine", ["2-4", "4-6", "6-8"], [
    "Bedtime has the same cozy steps every night: bath, pajamas, brush teeth, story, lights low.",
    "Screens go off before bed so our eyes and brain can get sleepy.",
    "Sleep helps our bodies grow and gives us energy to play tomorrow.",
  ], P),
  "trying-food": theme("habits", "試試新食物", "Trying new food", ["2-4", "4-6"], [
    "We can try just one small bite of a new food; we don't have to like it.",
    "Tasting is like exploring: notice its color, smell, crunch and taste.",
    "Our tastes change, so a food we didn't like before might become a favorite later.",
  ]),
  "tidying-toys": theme("habits", "收玩具", "Tidying up toys", ["2-4", "4-6"], [
    "After playing, toys go back to their homes so we can find them next time.",
    "Tidying is faster and more fun together, like a game or a song.",
    "Taking care of our things means they last longer.",
  ]),
  handwashing: theme("habits", "洗手", "Washing hands", ["2-4", "4-6"], [
    "Wash hands with soap before eating, after the toilet, and after playing outside.",
    "Rub palms, backs, between fingers, thumbs and nails, long enough to sing a short song, then rinse and dry.",
    "Clean hands help keep germs away from us and our friends.",
  ]),
  "doctor-shots": theme("habits", "看醫生打針", "Doctor visits and shots", ["2-4", "4-6"], [
    "Doctors and nurses help our bodies stay healthy and strong.",
    "A shot is a quick pinch; it's OK to feel scared or cry, and holding a grown-up's hand helps.",
    "Shots teach our body to fight germs, like a shield.",
  ]),
  dentist: theme("habits", "看牙醫", "Visiting the dentist", ["4-6", "6-8"], [
    "The dentist counts and checks our teeth to keep them healthy.",
    "The tools have funny names and sounds, and the dentist explains each one before using it.",
    "Raise your hand if you need a break; the dentist will stop and wait.",
  ]),
  "screen-time": theme("habits", "3C 時間", "Screen time", ["4-6", "6-8", "8-10"], [
    "We agree on screen time before we start, and stop when the timer rings.",
    "Stopping is hard and it's OK to feel disappointed; take a breath and choose something else fun.",
    "Playing, moving, reading and talking with family help our brains and eyes rest.",
  ]),
  "moving-house": theme("habits", "搬家", "Moving to a new home", ["4-6", "6-8", "8-10"], [
    "Moving can feel exciting and sad at the same time, and both feelings are OK.",
    "Our family, our favorite things and our memories come with us.",
    "Little by little, a new place becomes home: new corners, neighbors and friends.",
  ]),

  // 情緒與人際
  anger: theme("emotions", "生氣了", "Feeling angry", ["2-4", "4-6", "6-8"], [
    "Feeling angry is OK; hitting, kicking or throwing things is not.",
    "When anger feels big, stop, take slow deep breaths, and count.",
    "Use words to say what you feel and need: 'I'm angry because…'.",
  ], P),
  "new-sibling": theme("emotions", "有了弟弟妹妹", "A new baby sibling", ["2-4", "4-6"], [
    "Love doesn't shrink when a family grows; there is enough for everyone.",
    "It's OK to feel jealous or want attention; you can tell Mom or Dad.",
    "Being a big sibling has special jobs and special time with parents.",
  ], P),
  "sharing-turns": theme("emotions", "輪流與分享", "Sharing and taking turns", ["2-4", "4-6"], [
    "Taking turns means everyone gets to play; waiting is hard but your turn will come.",
    "You can ask 'Can I have a turn when you're done?' instead of grabbing.",
    "Sharing can make playing more fun together.",
  ]),
  manners: theme("emotions", "謝謝與對不起", "Thank you and sorry", ["2-4", "4-6"], [
    "Say 'please' when asking and 'thank you' when someone helps or gives you something.",
    "When we hurt someone, even by accident, we say sorry and try to make it better.",
    "Kind words make others feel good, and make us feel good too.",
  ]),
  "fear-of-dark": theme("emotions", "怕黑", "Afraid of the dark", ["2-4", "4-6"], [
    "The dark is just the same room with the lights resting; everything is still there.",
    "It's OK to feel scared; a night light, a cuddly toy and calling a grown-up can help.",
    "Night sounds have friendly explanations, and grown-ups are close by.",
  ]),
  "losing-failing": theme("emotions", "輸了也沒關係", "When I lose or make mistakes", ["4-6", "6-8", "8-10"], [
    "Everyone loses games and makes mistakes; it's how we learn and grow.",
    "It's OK to feel disappointed; take a breath, then try again or try differently.",
    "Being a good friend in a game, winning or losing, matters more than the score.",
  ]),
  honesty: theme("emotions", "說實話", "Telling the truth", ["4-6", "6-8"], [
    "Telling the truth can feel scary, especially after a mistake, but it is brave.",
    "Grown-ups can help fix a problem when they know what really happened.",
    "Honesty helps people trust each other.",
  ]),
  bullying: theme("emotions", "被欺負怎麼辦", "Standing up to bullying", ["6-8", "8-10"], [
    "Bullying is never OK, and it's never the fault of the child being bullied.",
    "Telling a teacher or parent is not tattling; it's getting help.",
    "Bystanders can help: stand with the child, include them, and tell a grown-up.",
  ]),
  "pet-loss": theme("emotions", "和寵物說再見", "Saying goodbye to a pet", ["4-6", "6-8", "8-10"], [
    "Feeling sad when a pet dies is normal; crying and missing them are part of loving them.",
    "We can remember our pet with stories, drawings and favorite memories.",
    "Sad feelings get softer with time, and the love stays.",
  ], { sensitive: true, aiAllowed: false }),

  // 品格
  gratitude: theme("values", "感恩", "Gratitude", ["2-4", "4-6", "6-8", "8-10"], [
    "Many people and things quietly help us every day; noticing them makes us feel rich.",
    "Saying or showing thanks makes both the giver and the receiver happy.",
    "We can say thank you with small actions, not only words.",
  ]),
  empathy: theme("values", "同理心", "Empathy", ["2-4", "4-6", "6-8", "8-10"], [
    "Other people have feelings just like ours, even when they show them differently.",
    "We can notice how someone feels by looking at their face and asking 'Are you OK?'.",
    "Imagining how it feels to be in someone else's place helps us know how to help.",
  ]),
  perseverance: theme("values", "堅持", "Keep trying", ["4-6", "6-8", "8-10"], [
    "Hard things get easier with practice; every try teaches us something.",
    "When we feel like giving up, we can rest, try a smaller step, or try a new way.",
    "Being proud of our effort matters more than being the best.",
  ]),
  courage: theme("values", "勇氣", "Being brave", ["2-4", "4-6", "6-8", "8-10"], [
    "Being brave doesn't mean not feeling scared; it means doing the right or kind thing while scared.",
    "Small brave steps count: trying something new, speaking up, or asking for help.",
    "Brave is not the same as risky; we stay safe and can bring a grown-up along.",
  ]),
  responsibility: theme("values", "負責任", "Taking responsibility", ["4-6", "6-8", "8-10"], [
    "Taking care of our own jobs, things and promises helps the people around us.",
    "When we make a mistake, we own it and help fix it instead of blaming others.",
    "Doing our part, even when no one is watching, makes us someone others can count on.",
  ]),
  "keeping-promises": theme("values", "說到做到", "Keeping promises", ["4-6", "6-8", "8-10"], [
    "A promise is a gift of trust; keeping it shows people they matter.",
    "Before promising, think about whether we can really do it.",
    "If we can't keep a promise, we say so honestly and try to make it right.",
  ]),
  "respecting-differences": theme("values", "尊重不一樣", "Respecting differences", ["2-4", "4-6", "6-8", "8-10"], [
    "People look, sound, eat, move and think in different ways, and every way deserves respect.",
    "Being different is not wrong; differences make friends and the world more interesting.",
    "We include others and stand by someone who is left out or laughed at.",
  ]),
  "caring-for-nature": theme("values", "愛護環境", "Caring for nature", ["2-4", "4-6", "6-8", "8-10"], [
    "Plants, animals, water and air are shared by everyone, and they need our care.",
    "Small daily actions help: not wasting, putting trash in the right place, being gentle with living things.",
    "We look at nature with curiosity and leave it as beautiful as we found it.",
  ]),
  teamwork: theme("values", "合作", "Working together", ["2-4", "4-6", "6-8", "8-10"], [
    "Some things are too big for one person but just right for many hands.",
    "Everyone has something to offer; listening to each other's ideas makes a better plan.",
    "Working together means taking turns, helping, and sharing the success.",
  ]),
  forgiveness: theme("values", "原諒", "Forgiveness", ["4-6", "6-8", "8-10"], [
    "Everyone makes mistakes; when someone says sorry and tries to fix it, we can choose to forgive.",
    "Forgiving lets go of a heavy, angry feeling and makes room for friendship again.",
    "Forgiving doesn't mean what happened was OK; it's fine to tell how it made us feel.",
  ]),
} as const satisfies Record<string, ThemeRule>;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as [ThemeId, ...ThemeId[]];

/** 即時 AI 故事可以選的主題，可依年齡層篩選 */
export function aiThemesFor(ageBand?: AgeBand): ThemeId[] {
  return THEME_IDS.filter((id) => {
    const t: ThemeRule = THEMES[id];
    return t.aiAllowed && (!ageBand || t.ages.includes(ageBand));
  });
}

// ---- 給爸媽的引導卡：2–3 個問小朋友的問題 + 1 個今晚就能做的小建議 ----
const GuideText = z.string().trim().min(1).max(300);
export const ParentGuideSchema = z.object({
  /** 大人問小朋友的問題 */
  questions: z.array(GuideText).min(2).max(3),
  /** 一件爸媽今晚就能做的具體小事 */
  tip: GuideText,
});
export type ParentGuide = z.infer<typeof ParentGuideSchema>;

// ---- API 契約 ----
export const StoryRequestSchema = z
  .object({
    language: z.enum(LANGUAGES),
    ageBand: z.enum(AGE_BANDS),
    style: z.enum(STORY_STYLES),
    length: z.enum(STORY_LENGTHS),
    hero: HeroSchema.optional(),
    /** 首次生成：前端壓縮後的 JPEG base64（不含 data: 前綴） */
    imageBase64: z.string().max(2_000_000).optional(),
    /** 再講一個：重用上次的場景描述，不再傳圖，省掉圖片 token */
    scene: z.string().max(2000).optional(),
    /** 換一個故事時，避免重複的上一個標題 */
    avoidTitle: z.string().max(200).optional(),
    /** 想聊的主題（選填）；只能選 aiAllowed 的主題 */
    theme: z.enum(THEME_IDS).optional(),
  })
  .refine((r) => r.imageBase64 || r.scene, {
    message: "imageBase64 or scene is required",
  })
  .refine((r) => !r.hero || ageBandFor(r.hero.age) === r.ageBand, {
    message: "ageBand must match hero.age",
  })
  .refine((r) => !r.theme || (THEMES[r.theme] as ThemeRule).aiAllowed, {
    message: "this theme is only available in the curated library",
    path: ["theme"],
  });
export type StoryRequest = z.infer<typeof StoryRequestSchema>;

export const StoryOutputSchema = z.object({
  /** 照片的中性描述（英文），存在裝置上供「再講一個」重用 */
  scene: z.string(),
  /** 故事主要發生的地方，決定閱讀頁背景 */
  setting: z.enum(STORY_SETTINGS),
  title: z.string(),
  paragraphs: z.array(z.string()),
  /** 有選主題時才有：給爸媽的引導卡 */
  guide: ParentGuideSchema.optional(),
});
export type StoryOutput = z.infer<typeof StoryOutputSchema>;

export interface StoryResponse {
  story: StoryOutput;
}

export interface ApiError {
  error: string;
}

// ---- 故事庫：人工審過、隨 App 打包的故事。在裝置上換成主角名字與代名詞，不花 LLM token ----
// 第二版的「KTV 模式」會讓爸媽一段一段錄音，所以段落是基本單位，中英文段落數必須一致。

/** 故事庫文字裡唯一允許的代換標記 */
export const LIBRARY_TOKENS = ["{name}", "{he}", "{him}", "{his}"] as const;
export type LibraryToken = (typeof LIBRARY_TOKENS)[number];

/** 沒選主角時用的預設名字（性別不指定） */
export const LIBRARY_DEFAULT_NAME: Record<Language, string> = { zh: "小寶", en: "Bo" };

const TOKEN_PATTERN = /\{[^{}]*\}/g;

/** 回傳文字中不被允許的 {...} 標記 */
export function invalidLibraryTokens(text: string): string[] {
  return (text.match(TOKEN_PATTERN) ?? []).filter((t) => !(LIBRARY_TOKENS as readonly string[]).includes(t));
}

const LibraryText = z
  .string()
  .trim()
  .min(1)
  .refine((s) => invalidLibraryTokens(s).length === 0, {
    message: `only ${LIBRARY_TOKENS.join(" ")} tokens are allowed`,
  });

const Bilingual = <T extends z.ZodType>(schema: T) => z.object({ zh: schema, en: schema });

/** 故事庫的引導卡：跟故事一樣可以用 {name} 等標記 */
const LibraryGuideSchema = z.object({
  questions: z.array(LibraryText).min(2).max(3),
  tip: LibraryText,
});

/** 不含整體檢查的欄位定義；生成器用它 omit 掉 id / draft 等欄位 */
export const LibraryStoryFieldsSchema = z.object({
  /** kebab-case slug，例如 "moon-blanket" */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  style: z.enum(STORY_STYLES),
  ageBands: z.array(z.enum(AGE_BANDS)).min(1),
  setting: z.enum(STORY_SETTINGS),
  title: Bilingual(LibraryText),
  paragraphs: Bilingual(z.array(LibraryText).min(1)),
  /** 主題（選填）；沒有主題的故事只出現在「全部」 */
  theme: z.enum(THEME_IDS).optional(),
  /** 給爸媽的引導卡（選填），有主題的故事才有 */
  guide: Bilingual(LibraryGuideSchema).optional(),
  /** 背景音樂檔名（選填，之後再加） */
  bgm: z.string().optional(),
  /** true = 還沒人工審過 */
  draft: z.boolean(),
});

export const LibraryStorySchema = LibraryStoryFieldsSchema.refine(
  (s) => s.paragraphs.zh.length === s.paragraphs.en.length,
  { message: "zh and en must have the same number of paragraphs", path: ["paragraphs"] },
);
export type LibraryStory = z.infer<typeof LibraryStorySchema>;

export interface LibraryHero {
  name: string;
  gender: Gender;
}

type PronounToken = "he" | "him" | "his";

function pronouns(language: Language, name: string, gender: Gender): Record<PronounToken, string> {
  if (language === "zh") {
    if (gender === "boy") return { he: "他", him: "他", his: "他的" };
    if (gender === "girl") return { he: "她", him: "她", his: "她的" };
    return { he: name, him: name, his: `${name}的` };
  }
  if (gender === "boy") return { he: "he", him: "him", his: "his" };
  if (gender === "girl") return { he: "she", him: "her", his: "her" };
  return { he: name, him: name, his: `${name}'s` };
}

/** 段落開頭，或句尾標點（可接收尾引號）加空白，之後可以有開頭引號 */
const SENTENCE_START = /(?:^|[.!?…]["'”’)]?\s+)["'“‘(]?$/;

function fillTokens(text: string, language: Language, name: string, words: Record<PronounToken, string>): string {
  return text.replace(/\{(name|he|him|his)\}/g, (_, token: "name" | PronounToken, offset: number) => {
    const value = token === "name" ? name : words[token];
    if (language === "en" && SENTENCE_START.test(text.slice(0, offset))) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  });
}

/** 把故事庫故事換成指定語言與主角；沒給主角就用預設名字、不指定性別 */
export function renderLibraryStory(
  story: Pick<LibraryStory, "title" | "paragraphs" | "guide">,
  language: Language,
  hero?: LibraryHero,
): { title: string; paragraphs: string[]; guide?: ParentGuide } {
  const name = hero?.name.trim() || LIBRARY_DEFAULT_NAME[language];
  const gender = hero ? hero.gender : "unspecified";
  const words = pronouns(language, name, gender);
  const fill = (text: string) => fillTokens(text, language, name, words);
  const guide = story.guide?.[language];
  return {
    title: fill(story.title[language]),
    paragraphs: story.paragraphs[language].map(fill),
    ...(guide ? { guide: { questions: guide.questions.map(fill), tip: fill(guide.tip) } } : {}),
  };
}

// ---- 朗讀（雲端 TTS，Azure Speech 神經語音）----
// 清單放在共用套件，之後要做「選聲音」時前後端用同一份。

/** 可用的語音；每種語言的第一個是預設 */
export const TTS_VOICES = {
  zh: ["zh-TW-HsiaoChenNeural", "zh-TW-HsiaoYuNeural", "zh-TW-YunJheNeural"],
  // AnaNeural 是童聲
  en: ["en-US-AnaNeural", "en-US-JennyNeural"],
} as const satisfies Record<Language, readonly string[]>;
export type TtsVoice = (typeof TTS_VOICES)[Language][number];

export const DEFAULT_VOICE: Record<Language, TtsVoice> = {
  zh: TTS_VOICES.zh[0],
  en: TTS_VOICES.en[0],
};

const ALL_VOICES = [...TTS_VOICES.zh, ...TTS_VOICES.en] as [TtsVoice, ...TtsVoice[]];

/** 單段朗讀的長度上限；故事段落與標題都遠低於這個數字 */
export const TTS_MAX_CHARS = 1200;

export const TtsRequestSchema = z
  .object({
    text: z.string().min(1).max(TTS_MAX_CHARS),
    language: z.enum(LANGUAGES),
    voice: z.enum(ALL_VOICES).optional(),
  })
  .refine((r) => !r.voice || (TTS_VOICES[r.language] as readonly string[]).includes(r.voice), {
    message: "voice must match language",
  });
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
