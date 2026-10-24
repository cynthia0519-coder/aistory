// 主角卡通頭像：全部用 SVG 畫，絕不使用真實照片或臉。
// 風格對齊 public/scenes 的插畫：平塗色塊、手剪般不規則的邊、淡淡的紙紋顆粒。
import { useId } from "react";
import { DEFAULT_LOOK, type HairColor, type HairStyle, type HeroLook, type Outfit, type SkinTone } from "@/lib/heroes";

// 顏色只用 globals.css 的設計 token（SVG 屬性不能吃 CSS 變數的 Tailwind class，所以寫成常數）
const INK = "#3a2a20";
const PAPER = "#f4ecdc";
const CARD = "#fbf6ea";
const TEAL = "#23465a";
const TEAL_DARK = "#17303e";
const RUST = "#c8553d";
const RUST_DARK = "#8a3420";
const OCHRE = "#e8b04a";
const MUSTARD = "#f2c14e";
const SAGE = "#8aa38b";
const HIGHLIGHT = "#f6d88e";

const SKIN: Record<SkinTone, { base: string; shade: string; blush: number }> = {
  light: { base: "#f3cfa6", shade: "#e2b088", blush: 0.42 },
  medium: { base: "#d69a6a", shade: "#bf8054", blush: 0.5 },
  deep: { base: "#96603f", shade: "#7c4c2f", blush: 0.7 },
};

const HAIR: Record<HairColor, string> = {
  dark: "#4a2f20",
  brown: "#7a4a2a",
  auburn: "#a24a2c",
};

/** 頭像圓底：跟衣服顏色錯開，才看得清楚 */
const BACKDROP: Record<Outfit, string> = {
  overalls: HIGHLIGHT,
  dress: "#e6d6b0",
  raincoat: "#b9c9b4",
  sweater: HIGHLIGHT,
};

interface Props {
  look?: HeroLook | null;
  /** bust：寬高；figure：高度（寬度是一半） */
  size: number;
  variant: "bust" | "figure";
  className?: string;
}

export function HeroAvatar({ look, size, variant, className }: Props) {
  const l = look ?? DEFAULT_LOOK;
  // useId 會帶冒號等符號，url(#…) 不一定認得，只留安全字元
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const grain = `hero-grain-${uid}`;
  const clip = `hero-clip-${uid}`;

  if (variant === "figure") {
    return (
      <svg
        aria-hidden="true"
        viewBox="8 14 84 166"
        width={(size * 84) / 166}
        height={size}
        className={className}
      >
        <GrainFilter id={grain} />
        <g filter={`url(#${grain})`}>
          <ellipse cx="50" cy="173" rx="27" ry="3.6" fill={INK} opacity="0.18" />
          <Character look={l} full />
        </g>
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="2 14 96 96" width={size} height={size} className={className}>
      <GrainFilter id={grain} />
      <clipPath id={clip}>
        <circle cx="50" cy="62" r="46.5" />
      </clipPath>
      <g filter={`url(#${grain})`}>
        <circle cx="50" cy="62" r="46.5" fill={BACKDROP[l.outfit]} />
        {/* 圓底上的一抹淡色，像手刷的顏料 */}
        <path d="M14 70 C24 58 40 92 86 74 C84 92 66 106 48 106 C30 106 16 92 14 70 Z" fill={OCHRE} opacity="0.22" />
        <g clipPath={`url(#${clip})`}>
          <g transform="translate(50 60) scale(1.22) translate(-50 -60)">
            <Character look={l} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** 紙紋顆粒 + 輕微扭曲邊緣（像手剪的色紙），每個實例各自一個 id */
function GrainFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="4" result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.8" xChannelSelector="R" yChannelSelector="G" result="cut" />
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="1" seed="11" result="fine" />
      <feColorMatrix
        in="fine"
        type="matrix"
        values="0 0 0 0 0.23  0 0 0 0 0.16  0 0 0 0 0.12  0.9 0 0 0 -0.47"
        result="dark"
      />
      <feComposite in="dark" in2="cut" operator="in" result="darkIn" />
      <feColorMatrix
        in="fine"
        type="matrix"
        values="0 0 0 0 0.98  0 0 0 0 0.95  0 0 0 0 0.88  0 -0.8 0 0 0.36"
        result="light"
      />
      <feComposite in="light" in2="cut" operator="in" result="lightIn" />
      <feMerge>
        <feMergeNode in="cut" />
        <feMergeNode in="darkIn" />
        <feMergeNode in="lightIn" />
      </feMerge>
    </filter>
  );
}

// ---- 角色本體：座標系寬 100，頭中心 (50,50)，腳底約 y=172 ----

function Character({ look, full }: { look: HeroLook; full?: boolean }) {
  const skin = SKIN[look.skin];
  const hair = HAIR[look.hairColor];
  return (
    <g>
      {full && <Legs outfit={look.outfit} skin={skin.base} />}
      <HairBack style={look.hair} color={hair} />
      {/* 脖子 */}
      <path d="M44.5 66 L55.5 66 L56 80 L44 80 Z" fill={skin.shade} />
      <Top outfit={look.outfit} skin={skin.base} />
      <Face skin={skin} />
      <HairFront style={look.hair} color={hair} />
      {look.glasses && <Glasses />}
    </g>
  );
}

function Face({ skin }: { skin: { base: string; shade: string; blush: number } }) {
  return (
    <g>
      <ellipse cx="28.6" cy="54" rx="4.2" ry="4.8" fill={skin.shade} />
      <ellipse cx="71.4" cy="54" rx="4.2" ry="4.8" fill={skin.shade} />
      <path
        d="M50 29 C63 29 72.5 37 72.3 50.5 C72 63 62.5 71.5 50 71.5 C37.5 71.5 27.8 63.5 27.7 50.5 C27.6 37.5 37 29 50 29 Z"
        fill={skin.base}
      />
      {/* 腮紅 */}
      <ellipse cx="37" cy="60" rx="4.6" ry="2.9" fill={RUST} opacity={skin.blush} />
      <ellipse cx="63" cy="60" rx="4.6" ry="2.9" fill={RUST} opacity={skin.blush} />
      {/* 豆豆眼 */}
      <ellipse cx="42" cy="53.5" rx="2.2" ry="2.5" fill={INK} />
      <ellipse cx="58" cy="53.5" rx="2.2" ry="2.5" fill={INK} />
      {/* 小小的微笑 */}
      <path d="M46.6 61.4 Q50 64.6 53.4 61.4" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function Glasses() {
  return (
    <g fill="none" stroke={INK} strokeWidth="1.5">
      <circle cx="42" cy="53.5" r="5.8" fill={CARD} fillOpacity="0.18" />
      <circle cx="58" cy="53.5" r="5.8" fill={CARD} fillOpacity="0.18" />
      <path d="M47.8 53 Q50 51.4 52.2 53" strokeLinecap="round" />
    </g>
  );
}

function HairBack({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "bob":
      return (
        <path
          d="M24.5 50 C23 29 36 21.5 50 21.5 C64.5 21.5 77.5 29 76 50 L77 73 C71 76.5 63.5 76 59.5 72.5 L40.5 72.5 C36.5 76 29 76.5 23.5 73 Z"
          fill={color}
        />
      );
    case "ponytail":
      return (
        <g>
          <path d="M26 50 C25 31 38 23.5 51 23.5 C64 23.5 75.5 31 74.5 50 Z" fill={color} />
          <path d="M67 31 C80 25 91 34 88 49 C86.5 58 90 66 84 75 C81 66 75 61 72.5 51 C71 44 69 37 67 31 Z" fill={color} />
          <ellipse cx="70.5" cy="32" rx="3.6" ry="3" fill={RUST} transform="rotate(-30 70.5 32)" />
        </g>
      );
    case "braids":
      return <path d="M26 52 C25 31 38 23.5 50 23.5 C62 23.5 75 31 74 52 Z" fill={color} />;
    case "curly":
      return (
        <g fill={color}>
          {[
            [26.5, 60, 8],
            [24, 47, 9],
            [28.5, 34, 9.5],
            [39, 25.5, 10],
            [51, 22.5, 10],
            [63, 25, 10],
            [72, 34, 9.5],
            [76, 47, 9],
            [73.5, 60, 8],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    default:
      return <path d="M26.5 50 C25.5 31 38 24 50.5 24 C63.5 24 75 31 74 50 Z" fill={color} />;
  }
}

function HairFront({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "bob":
      return (
        <path
          d="M26.5 52 C25.5 33 37 26 50 26 C63 26 74.5 33 73.5 52 C72.5 47 71.5 43.5 70.5 41.5 C64 43.5 57 40.5 50 42.5 C43 40.5 36 43.5 29.5 41.5 C28.2 44 27.2 47.5 26.5 52 Z"
          fill={color}
        />
      );
    case "ponytail":
      return (
        <path
          d="M27.2 50 C26.5 32 39 26 51 26 C63.5 26 74 32.5 73 48 C67 40 57.5 36 47 37.5 C39 38.5 31.5 43 27.2 50 Z"
          fill={color}
        />
      );
    case "braids":
      return (
        <g>
          <path
            d="M27.2 53 C26.2 33 38.5 26 50 26 C61.5 26 73.8 33 72.8 53 C71 43 62 36.5 50.5 36 C38.5 36.5 29.5 43 27.2 53 Z"
            fill={color}
          />
          {/* 中分線 */}
          <path d="M50 27.5 L50.4 35.5" stroke={INK} strokeWidth="0.9" opacity="0.45" />
          {[-1, 1].map((side) => {
            const x = 50 + side * 22.5;
            return (
              <g key={side}>
                {[60, 67, 74, 81].map((y, i) => (
                  <ellipse key={y} cx={x + side * (i % 2 ? 0.8 : 0)} cy={y} rx="4.8" ry="4.3" fill={color} />
                ))}
                <ellipse cx={x + side * 0.4} cy="87" rx="3" ry="1.9" fill={OCHRE} />
                <path
                  d={`M${x - 2.6} 88 Q${x} 95 ${x + 2.6} 88 Z`}
                  fill={color}
                />
              </g>
            );
          })}
        </g>
      );
    case "curly":
      return (
        <g fill={color}>
          {[
            [33, 38, 6.5],
            [40.5, 33.5, 6.5],
            [49, 32, 6.8],
            [57.5, 33.5, 6.5],
            [65.5, 37.5, 6.5],
            [70.5, 44, 5],
            [29.5, 44.5, 5],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    default:
      return (
        <g fill={color}>
          <path d="M27.5 50 C26.5 32 38.5 26.5 50.5 26.5 C63 26.5 74 32.5 73 50 C70.5 44 67 40.5 62 38.5 C58.5 42 51 43.5 43.5 41.5 C39 44.5 33 45.5 30.5 49 Z" />
          {/* 頭頂翹起的一撮 */}
          <path d="M47.5 27 C46.5 21 51.5 17.5 56.5 19.5 C53.5 21 52.5 23.5 53.5 27 Z" />
        </g>
      );
  }
}

/** 上衣（含手臂） */
function Top({ outfit, skin }: { outfit: Outfit; skin: string }) {
  switch (outfit) {
    case "dress":
      return (
        <g>
          <Arm side={-1} sleeve={RUST} skin={skin} short />
          <Arm side={1} sleeve={RUST} skin={skin} short />
          <path d="M35 78 C41 74.5 59 74.5 65 78 L66.5 96 L77.5 146 C60 150.5 40 150.5 22.5 146 L33.5 96 Z" fill={RUST} />
          {/* 小圓點花紋 */}
          {[
            [40, 112],
            [55, 106],
            [47, 127],
            [62, 124],
            [34, 136],
            [52, 141],
            [67, 140],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.5" fill={MUSTARD} opacity="0.85" />
          ))}
          {/* 圓領 */}
          <path d="M41.5 76.5 Q44 84.5 50 79 Q56 84.5 58.5 76.5 Q50 79.5 41.5 76.5 Z" fill={CARD} />
        </g>
      );
    case "raincoat":
      return (
        <g>
          {/* 帽子垂在後面 */}
          <path d="M35 80 C33 70 41 66.5 50 66.5 C59 66.5 67 70 65 80 Z" fill={OCHRE} />
          <path d="M32.5 79 C39 74.5 61 74.5 67.5 79 L70.5 99 L73.5 142 C58 145.5 42 145.5 26.5 142 L29.5 99 Z" fill={MUSTARD} />
          <path d="M50 79 L50 143" stroke={INK} strokeWidth="1" opacity="0.35" />
          {[90, 104, 118].map((y) => (
            <circle key={y} cx="54" cy={y} r="1.9" fill={TEAL} />
          ))}
          {/* 口袋 */}
          <path d="M35 120 L44 120 M56 120 L65 120" stroke={OCHRE} strokeWidth="2.4" strokeLinecap="round" />
          <Arm side={-1} sleeve={MUSTARD} skin={skin} />
          <Arm side={1} sleeve={MUSTARD} skin={skin} />
        </g>
      );
    case "sweater":
      return (
        <g>
          <path d="M31.5 81 C37 75.5 63 75.5 68.5 81 L69.5 121 C56 125 44 125 30.5 121 Z" fill={SAGE} />
          {/* 橫條紋，像場景裡小男生的毛衣 */}
          <path d="M31.2 95 C44 96.5 56 93.5 68.8 95.2 L68.9 99.2 C56 97.5 44 100.5 31.2 99 Z" fill={CARD} opacity="0.85" />
          <path d="M31.2 105 C44 106.5 56 103.5 69 105.2 L69.1 109 C56 107.5 44 110.5 31.2 109 Z" fill={CARD} opacity="0.85" />
          <path d="M30.6 116 C44 119.5 56 119.5 69.4 116 L69.5 121 C56 125 44 125 30.5 121 Z" fill="#6f8a70" />
          <path d="M42 77 Q50 83.5 58 77 Q50 79.5 42 77 Z" fill={OCHRE} />
          <Arm side={-1} sleeve={SAGE} skin={skin} />
          <Arm side={1} sleeve={SAGE} skin={skin} />
        </g>
      );
    default:
      // 吊帶褲：米白條紋上衣 + 深藍綠吊帶褲
      return (
        <g>
          <path d="M31.5 81 C37 75.5 63 75.5 68.5 81 L69.5 119 L30.5 119 Z" fill={CARD} />
          <path d="M32 87 L68 87 M31.5 95 L68.5 95" stroke={RUST} strokeWidth="2.4" opacity="0.75" />
          <path d="M37 92 L63 92 L64.5 119 L35.5 119 Z" fill={TEAL} />
          <path d="M39.5 93.5 L36 79 M60.5 93.5 L64 79" stroke={TEAL} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="40.5" cy="96.5" r="1.7" fill={MUSTARD} />
          <circle cx="59.5" cy="96.5" r="1.7" fill={MUSTARD} />
          <path d="M44 101 L56 101 L55.5 109 L44.5 109 Z" fill={TEAL_DARK} opacity="0.5" />
          <Arm side={-1} sleeve={CARD} skin={skin} />
          <Arm side={1} sleeve={CARD} skin={skin} />
        </g>
      );
  }
}

function Arm({ side, sleeve, skin, short }: { side: -1 | 1; sleeve: string; skin: string; short?: boolean }) {
  const x = (v: number) => 50 + side * v;
  const path = `M${x(16)} 82 C${x(22)} 90 ${x(24.5)} 101 ${x(23.5)} 112`;
  return (
    <g>
      <path d={path} fill="none" stroke={short ? skin : sleeve} strokeWidth="10" strokeLinecap="round" />
      {short && <ellipse cx={x(18)} cy="84.5" rx="7" ry="6.2" fill={sleeve} />}
      <circle cx={x(23.5)} cy="116" r="5" fill={skin} />
    </g>
  );
}

/** 腿、褲子與鞋（只有全身版才畫） */
function Legs({ outfit, skin }: { outfit: Outfit; skin: string }) {
  const shoe = (color: string) => (
    <g fill={color}>
      <path d="M36 163 C36 160 46.5 160 46.5 163.5 L46.5 168 C46.5 170 34 170.5 33 168.5 C32.5 166 34 164 36 163 Z" />
      <path d="M64 163 C64 160 53.5 160 53.5 163.5 L53.5 168 C53.5 170 66 170.5 67 168.5 C67.5 166 66 164 64 163 Z" />
    </g>
  );
  switch (outfit) {
    case "dress":
      return (
        <g>
          <rect x="38.5" y="140" width="8" height="24" rx="2" fill={skin} />
          <rect x="53.5" y="140" width="8" height="24" rx="2" fill={skin} />
          <rect x="38" y="157" width="9" height="6" fill={CARD} />
          <rect x="53" y="157" width="9" height="6" fill={CARD} />
          {shoe(INK)}
        </g>
      );
    case "raincoat":
      return (
        <g>
          <rect x="38.5" y="138" width="8" height="16" fill={skin} />
          <rect x="53.5" y="138" width="8" height="16" fill={skin} />
          {/* 雨鞋 */}
          <path d="M37.5 150 L47 150 L47 168.5 C42 170.5 35 170.5 33 168 C33 165 35.5 163.5 37.5 163 Z" fill={TEAL} />
          <path d="M62.5 150 L53 150 L53 168.5 C58 170.5 65 170.5 67 168 C67 165 64.5 163.5 62.5 163 Z" fill={TEAL} />
        </g>
      );
    case "sweater":
      return (
        <g>
          <rect x="38.5" y="140" width="8" height="24" rx="2" fill={skin} />
          <rect x="53.5" y="140" width="8" height="24" rx="2" fill={skin} />
          <path d="M31.5 118 L68.5 118 L69.5 146 L52.5 146 L50 131 L47.5 146 L30.5 146 Z" fill={RUST_DARK} />
          <rect x="38" y="156" width="9" height="7" fill={CARD} />
          <rect x="53" y="156" width="9" height="7" fill={CARD} />
          {shoe(TEAL_DARK)}
        </g>
      );
    default:
      return (
        <g>
          <path d="M31 115 L69 115 L69.5 160 L52 160 L50.5 130 L49.5 130 L48 160 L30.5 160 Z" fill={TEAL} />
          <path d="M31.8 155 L47.6 155 M52.4 155 L68.3 155" stroke={TEAL_DARK} strokeWidth="2" opacity="0.6" />
          <rect x="38" y="159" width="9" height="4.5" fill={PAPER} />
          <rect x="53" y="159" width="9" height="4.5" fill={PAPER} />
          {shoe(RUST)}
        </g>
      );
  }
}
