// 頻道原創系列「三兄妹」：主角是創辦人真實的三個孩子（則則、茜茜、沐沐），名字固定、不換成聽眾孩子的名字。
// 系列 id 沿用 "mumu-jerry"（茜茜加入前的名稱），只是內部代號。
// 角色設定的完整版在 docs/characters.md；這裡只放評審與節目文字要用的部分，改設定時兩邊一起改。
import type { Language, LibraryStory } from "@aistory/shared";

export const CAST_SERIES = {
  "mumu-jerry": {
    name: { zh: "三兄妹", en: "Three Siblings" },
    intro: {
      zh: "Family first。這是我的孩子們，則則、茜茜和沐沐的故事（靈感來自真實的三兄妹，情節經過改編）。",
      en: "Family first. A story of my children, Jerry, Bella and Mumu (inspired by three real siblings; stories are adapted).",
    },
    /** 給 AI 預審看的角色設定 */
    notes: `This is an original episode of the channel's series about three real siblings. Their names are fixed and are not hero tokens: never report missing {name} tokens or the use of their names and pronouns.
- 沐沐 / Mumu: girl, 4, in kindergarten. Outgoing and curious, loves "studying the rules of the world"; lies down on the floor when she is comfortable; loves food and gives a thumbs-up for yummy food. Each episode she discovers a "new rule" and says goodnight with "明天，我要研究新的規則". She cannot read or write.
- 則則 / Jerry: boy, 10, her big brother. Speaks in short, simple sentences of a few words (「繩子呢？」「我要叫車！」); says 「好！」/ "Okay!" and 「很棒！」/ "Great!" with a thumbs-up. Persistent when he wants something, remembers what grown-ups said, loves drawing and repeating patterns. Cannot read yet. Strong, steady walker after years of hiking every other week; he used to climb stairs slowly holding the rail. He never carries his sister; they hold hands.
- 茜茜 / Bella: girl, 9, the middle child, in primary school. Smart; does gymnastics (can do the splits) and swims; twists balloon flowers and has sold them at a market stall as a "little shop owner". Gives a V-sign pose. Fiercely loyal to her big brother. Family first.
- Report as logic any line where Mumu reads or writes, Bella is described as unloved, neglected or sacrificing herself for her brother, a test score is treated as her worth, Jerry reads or speaks in long, complex sentences, or Jerry carries Mumu. Mumu eating a lot is only ever about sharing, never about body size.`,
  },
} as const;

export function castSeries(story: Pick<LibraryStory, "cast">) {
  return story.cast ? CAST_SERIES[story.cast.series] : undefined;
}

export function castTitle(story: Pick<LibraryStory, "cast">, title: string, language: Language): string | undefined {
  const s = castSeries(story);
  if (!s || !story.cast) return undefined;
  return language === "zh"
    ? `${s.name.zh} EP${story.cast.episode}｜${title}`
    : `${s.name.en} EP${story.cast.episode} | ${title}`;
}
