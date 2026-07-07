export type DeviceType =
  | "iphone"
  | "ipad"
  | "android"
  | "windows"
  | "mac"
  | "linux"
  | "other";

export interface DeviceInfo {
  deviceType: DeviceType;
  os: string | null;
  browser: string | null;
  isBot: boolean;
}

const BOT_RE =
  /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|slackbot|telegrambot|discordbot|twitterbot|linkedinbot|pinterest|preview|headless|lighthouse|pingdom|uptime/i;

export function detectDevice(ua: string | null): DeviceInfo {
  const s = ua ?? "";
  const isBot = BOT_RE.test(s);

  let deviceType: DeviceType = "other";
  let os: string | null = null;

  if (/iPhone/i.test(s)) {
    deviceType = "iphone";
    os = iosVersion(s);
  } else if (/iPad/i.test(s)) {
    deviceType = "ipad";
    os = iosVersion(s);
  } else if (/Android/i.test(s)) {
    deviceType = "android";
    const m = s.match(/Android\s?(\d+(?:\.\d+)?)/i);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/Windows/i.test(s)) {
    deviceType = "windows";
    os = "Windows";
  } else if (/Macintosh|Mac OS X/i.test(s)) {
    deviceType = "mac";
    os = "macOS";
  } else if (/Linux|X11|CrOS/i.test(s)) {
    deviceType = "linux";
    os = /CrOS/i.test(s) ? "ChromeOS" : "Linux";
  }

  return { deviceType, os, browser: detectBrowser(s), isBot };
}

function iosVersion(s: string): string {
  const m = s.match(/OS (\d+)[._](\d+)/);
  return m ? `iOS ${m[1]}.${m[2]}` : "iOS";
}

function detectBrowser(s: string): string | null {
  if (!s) return null;
  // Navigateurs intégrés aux applications : précieux comme source de trafic
  if (/Instagram/i.test(s)) return "Instagram (in-app)";
  if (/FBAN|FBAV|FB_IAB/i.test(s)) return "Facebook (in-app)";
  if (/TikTok|musical_ly|Bytedance/i.test(s)) return "TikTok (in-app)";
  if (/Snapchat/i.test(s)) return "Snapchat (in-app)";
  if (/Line\//i.test(s)) return "LINE (in-app)";
  if (/EdgiOS|EdgA|Edg\//i.test(s)) return "Edge";
  if (/OPR\/|Opera/i.test(s)) return "Opera";
  if (/SamsungBrowser/i.test(s)) return "Samsung Internet";
  if (/FxiOS|Firefox\//i.test(s)) return "Firefox";
  if (/CriOS|Chrome\//i.test(s)) return "Chrome";
  if (/Safari\//i.test(s)) return "Safari";
  return null;
}

/** Première langue de l'en-tête Accept-Language (ex. "fr-FR"). */
export function detectLanguage(headers: Headers): string | null {
  const al = headers.get("accept-language");
  if (!al) return null;
  const first = al.split(",")[0]?.trim().split(";")[0];
  return first || null;
}
