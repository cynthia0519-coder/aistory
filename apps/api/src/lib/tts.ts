// 雲端朗讀：Azure Speech 神經語音（REST API）。只在伺服器執行，金鑰不會出現在前端。
// 文字裡有小孩的名字，所以任何情況都不記錄文字內容，只記錄狀態碼。
import { DEFAULT_VOICE, type Language, type TtsVoice } from "@aistory/shared";
import { buildSsml } from "@aistory/shared/ssml";

/** 沒設定 AZURE_SPEECH_KEY / AZURE_SPEECH_REGION：前端會改用裝置內建語音 */
export class TtsUnavailableError extends Error {
  constructor() {
    super("tts not configured");
    this.name = "TtsUnavailableError";
  }
}

/** Azure 回錯誤或連不上 */
export class TtsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TtsError";
  }
}

const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const TIMEOUT_MS = 15_000;

function config() {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) return null;
  // region 只會是像 eastasia 這樣的代碼；擋掉奇怪的值，避免組出別的網址
  if (!/^[a-z0-9]+$/.test(region)) return null;
  return { key, region };
}

export function isTtsConfigured(): boolean {
  return config() !== null;
}

export async function synthesize({
  text,
  language,
  voice,
}: {
  text: string;
  language: Language;
  voice?: TtsVoice;
}): Promise<ArrayBuffer> {
  const cfg = config();
  if (!cfg) throw new TtsUnavailableError();

  let res: Response;
  try {
    res = await fetch(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": cfg.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
        "User-Agent": "aistory-tts",
      },
      body: buildSsml(text, voice ?? DEFAULT_VOICE[language]),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new TtsError(err instanceof Error ? err.name : "fetch failed");
  }
  if (!res.ok) {
    // 不讀回應內容：Azure 的錯誤訊息有時會引用請求內容
    throw new TtsError(`azure tts ${res.status}`, res.status);
  }
  return res.arrayBuffer();
}
