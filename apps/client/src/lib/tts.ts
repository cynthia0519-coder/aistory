// 朗讀介面。目前使用瀏覽器內建 Web Speech API；
// 上架 App 時可換成原生 TTS（Capacitor 外掛），只要實作同一個介面，呼叫端不用改。
import type { Language } from "@aistory/shared";

export interface Narrator {
  isSupported(): boolean;
  speak(text: string, language: Language, onEnd: () => void): void;
  stop(): void;
}

const LOCALES: Record<Language, string[]> = {
  zh: ["zh-TW", "zh-HK", "zh-CN", "zh"],
  en: ["en-US", "en-GB", "en"],
};

function pickVoice(language: Language): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  for (const locale of LOCALES[language]) {
    const local = voices.find((v) => v.lang.replace("_", "-").startsWith(locale) && v.localService);
    if (local) return local; // 優先用裝置內建語音，離線也能念
    const any = voices.find((v) => v.lang.replace("_", "-").startsWith(locale));
    if (any) return any;
  }
  return undefined;
}

export const webSpeechNarrator: Narrator = {
  isSupported: () => typeof window !== "undefined" && "speechSynthesis" in window,
  speak(text, language, onEnd) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(language);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? LOCALES[language][0];
    utterance.rate = 0.9; // 給小孩聽，稍微放慢
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    speechSynthesis.speak(utterance);
  },
  stop() {
    speechSynthesis.cancel();
  },
};
