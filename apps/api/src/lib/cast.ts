// 頻道原創系列「沐沐與則則」：主角是創辦人真實的一對兄妹，名字固定、不換成聽眾孩子的名字。
// 角色設定的完整版在 docs/characters.md；這裡只放評審與節目文字要用的部分，改設定時兩邊一起改。
import type { Language, LibraryStory } from "@aistory/shared";

export const CAST_SERIES = {
  "mumu-jerry": {
    name: { zh: "沐沐與則則", en: "Mumu & Jerry" },
    intro: {
      zh: "這是我的孩子們，沐沐和則則的故事（靈感來自真實的兄妹，情節經過改編）。",
      en: "A story of my children, Mumu and Jerry (inspired by a real brother and sister; stories are adapted).",
    },
    /** 給 AI 預審看的角色設定 */
    notes: `This is an original episode of the channel's series about two real siblings. Their names are fixed and are not hero tokens: never report missing {name} tokens or the use of their names and pronouns.
- 沐沐 / Mumu: girl, 4, in kindergarten. Outgoing and curious, loves "studying the rules of the world"; lies down on the floor when she is comfortable; loves food and gives a thumbs-up for yummy food. Each episode she discovers a "new rule" and says goodnight with "明天，我要研究新的規則". She cannot read or write.
- 則則 / Jerry: boy, 10, her big brother. Speaks in short words only: 「好！」/ "Okay!" and 「很棒！」/ "Great!", with a thumbs-up. Cannot read yet. Strong, steady walker after years of hiking every other week; he used to climb stairs slowly holding the rail. He never carries his sister; they hold hands.
- Report as logic any line where Mumu reads or writes, Jerry reads or speaks in long sentences, or Jerry carries Mumu. Mumu eating a lot is only ever about sharing, never about body size.`,
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
