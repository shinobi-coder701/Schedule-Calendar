// Client-side notification scheduler for upcoming meetings.
// Triggers browser notifications at 60, 30 and 10 minutes before start.
// Only works while a tab is open (Web Notifications API limitation).

import meetIcon from "@/assets/meet.png.asset.json";
import zoomIcon from "@/assets/zoom.png.asset.json";
import teamsIcon from "@/assets/teams.png.asset.json";
import bannerImage from "@/assets/calendar-3d-banner.jpg";

const PLATFORM_ICONS: { match: RegExp; icon: string; name: string }[] = [
  { match: /meet\.google\.com/i, icon: meetIcon.url, name: "Google Meet" },
  { match: /zoom\.(us|com)/i, icon: zoomIcon.url, name: "Zoom" },
  { match: /teams\.(microsoft|live)\.com/i, icon: teamsIcon.url, name: "Microsoft Teams" },
];

function absolute(url: string) {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

const OFFSETS_MIN = [60, 30, 10];
const STORAGE_KEY = "callcal_notified_v1";

function loadNotified(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    /* ignore */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export type ScheduleLike = {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_link: string;
  company_name: string | null;
  user_name: string;
};

export function checkAndNotify(schedules: ScheduleLike[]) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notified = loadNotified();
  const now = Date.now();
  let changed = false;

  for (const s of schedules) {
    const start = new Date(s.scheduled_at).getTime();
    if (isNaN(start) || start < now) continue;

    for (const off of OFFSETS_MIN) {
      const fireAt = start - off * 60_000;
      // Fire if within a ~90s window in the past, and not yet notified.
      if (now >= fireAt && now - fireAt < 90_000) {
        const key = `${s.id}:${off}`;
        if (notified.has(key)) continue;

        const label =
          off === 60 ? "in 1 hour" : off === 30 ? "in 30 minutes" : "in 10 minutes";
        try {
          const platform = s.meeting_link
            ? PLATFORM_ICONS.find((p) => p.match.test(s.meeting_link))
            : undefined;
          const n = new Notification(`Call ${label}: ${s.title}`, {
            body: [
              s.company_name,
              platform?.name,
              `by ${s.user_name}`,
            ]
              .filter(Boolean)
              .join(" · "),
            tag: key,
            icon: absolute(platform?.icon ?? bannerImage),
            badge: absolute("/favicon.ico"),
            // Large preview image of this website (supported browsers)
            image: absolute(bannerImage),
          } as NotificationOptions & { image?: string });
          n.onclick = () => {
            window.focus();
            if (s.meeting_link) window.open(s.meeting_link, "_blank");
          };
        } catch {
          /* ignore */
        }
        notified.add(key);
        changed = true;
      }
    }
  }

  if (changed) saveNotified(notified);
}
