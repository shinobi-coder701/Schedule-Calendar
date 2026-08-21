import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,

  ExternalLink,
  Globe,
  Link2,
  LogOut,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  User as UserIcon,
  Users,
  Video,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchCompanyInfo } from "@/lib/company.functions";
import {
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "@/lib/calendar-export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  checkAndNotify,
  requestNotificationPermission,
  type ScheduleLike,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import calendarBanner from "@/assets/calendar-3d-banner.jpg";
import emptyDay from "@/assets/empty-day.png";
import day3d from "@/assets/day-3d.png";
import bg3d from "@/assets/bg-3d.jpg";
import meetIcon from "@/assets/meet.png.asset.json";
import zoomIcon from "@/assets/zoom.png.asset.json";
import teamsIcon from "@/assets/teams.png.asset.json";



type Schedule = Database["public"]["Tables"]["schedules"]["Row"];


const NAME_KEY = "callcal_name_v1";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CallCal — Shared Meeting Calendar" },
      {
        name: "description",
        content:
          "A shared month-view calendar for teams. Join with just your name and schedule calls together with automatic company info and reminders.",
      },
      { property: "og:title", content: "CallCal — Shared Meeting Calendar" },
      {
        property: "og:description",
        content:
          "A shared month-view calendar for teams. Join with just your name and schedule calls together with automatic company info and reminders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [name, setName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
  }, []);

  if (!hydrated) return null;
  if (!name)
    return (
      <JoinCard
        onJoin={(n) => {
          localStorage.setItem(NAME_KEY, n);
          setName(n);
        }}
      />
    );
  return (
    <CalendarView
      name={name}
      onLeave={() => {
        localStorage.removeItem(NAME_KEY);
        setName(null);
      }}
    />
  );
}

/* ---------------- Join screen ---------------- */

function JoinCard({ onJoin }: { onJoin: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden bg-neutral-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.35),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(236,72,153,0.25),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(56,189,248,0.25),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <Card className="relative w-full max-w-md p-8 shadow-2xl border-white/10 bg-white/5 backdrop-blur-xl text-white">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <CalendarClock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CallCal</h1>
            <p className="text-[11px] text-white/60 -mt-0.5">Shared meeting calendar</p>
          </div>
        </div>
        <p className="text-sm text-white/70 mb-6">
          Type your name to join. Everyone shares the same beautiful calendar.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) return toast.error("Please enter your name");
            if (trimmed.length > 40) return toast.error("Name is too long (max 40 chars)");
            onJoin(trimmed);
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="name" className="text-white/80">
              Your name
            </Label>
            <Input
              id="name"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={40}
              className="mt-1 bg-white/10 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-white/40"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/25 border-0"
          >
            Enter calendar
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ---------------- Calendar view (month grid) ---------------- */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Curated, visually distinct palette — each user gets their own colorway
const USER_PALETTE = [
  { h: 231, h2: 262 }, // indigo → violet
  { h: 330, h2: 350 }, // pink → rose
  { h: 175, h2: 195 }, // teal → cyan
  { h: 25, h2: 42 }, // orange → amber
  { h: 142, h2: 165 }, // emerald → teal
  { h: 268, h2: 292 }, // violet → fuchsia
  { h: 200, h2: 222 }, // sky → blue
  { h: 350, h2: 12 }, // rose → red
  { h: 95, h2: 120 }, // lime → green
  { h: 45, h2: 30 }, // amber → orange
  { h: 300, h2: 325 }, // fuchsia → pink
  { h: 190, h2: 210 }, // cyan → sky
];

function colorFor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n = (n * 31 + name.charCodeAt(i)) >>> 0;
  const { h, h2 } = USER_PALETTE[n % USER_PALETTE.length];
  return {
    bg: `hsl(${h} 90% 96%)`,
    border: `hsl(${h} 65% 82%)`,
    text: `hsl(${h} 60% 28%)`,
    dot: `hsl(${h} 72% 52%)`,
    gradient: `linear-gradient(135deg, hsl(${h} 78% 55%), hsl(${h2} 78% 60%))`,
    soft: `linear-gradient(135deg, hsl(${h} 95% 97%), hsl(${h2} 95% 95%))`,
    ring: `hsl(${h} 72% 52% / 0.35)`,
  };
}

/* ---------------- Meeting platforms ---------------- */

const PLATFORMS = [
  {
    id: "meet",
    label: "Google Meet",
    short: "Meet",
    match: /meet\.google\.com/i,
    icon: meetIcon.url,
    placeholder: "https://meet.google.com/abc-defg-hij",
    color: "hsl(142 62% 40%)",
    gradient: "linear-gradient(135deg, hsl(142 65% 45%), hsl(200 80% 50%))",
    soft: "hsl(142 60% 96%)",
  },
  {
    id: "zoom",
    label: "Zoom",
    short: "Zoom",
    match: /zoom\.(us|com)/i,
    icon: zoomIcon.url,
    placeholder: "https://zoom.us/j/1234567890",
    color: "hsl(214 90% 52%)",
    gradient: "linear-gradient(135deg, hsl(214 92% 55%), hsl(200 92% 62%))",
    soft: "hsl(214 90% 96%)",
  },
  {
    id: "teams",
    label: "Microsoft Teams",
    short: "Teams",
    match: /teams\.(microsoft|live)\.com/i,
    icon: teamsIcon.url,
    placeholder: "https://teams.microsoft.com/l/meetup-join/…",
    color: "hsl(250 62% 55%)",
    gradient: "linear-gradient(135deg, hsl(250 65% 58%), hsl(268 70% 62%))",
    soft: "hsl(250 70% 97%)",
  },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

function platformOf(link: string | null | undefined) {
  if (!link) return null;
  return PLATFORMS.find((p) => p.match.test(link)) ?? null;
}

function PlatformBadge({
  link,
  size = "sm",
}: {
  link: string | null | undefined;
  size?: "xs" | "sm";
}) {
  const p = platformOf(link);
  if (!p) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold text-white shrink-0 ${
        size === "xs" ? "px-1.5 py-[1px] text-[8px]" : "px-2 py-0.5 text-[10px]"
      }`}
      style={{
        background: p.gradient,
        boxShadow: `0 2px 6px -2px ${p.color}, 0 1px 0 0 hsl(0 0% 100% / 0.5) inset`,
      }}
    >
      <img
        src={p.icon}
        alt=""
        className={`${size === "xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]`}
      />
      {p.short}
    </span>
  );
}


function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function CalendarView({ name, onLeave }: { name: string; onLeave: () => void }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState<string>("");
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [detail, setDetail] = useState<Schedule | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (!mounted) return;
      if (error) toast.error("Failed to load schedules");
      setSchedules(data ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel("schedules-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules" },
        () => {
          supabase
            .from("schedules")
            .select("*")
            .order("scheduled_at", { ascending: true })
            .then(({ data }) => {
              if (data) setSchedules(data);
            });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const tick = () => checkAndNotify(schedules as ScheduleLike[]);
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [schedules]);

  const enableNotifications = async () => {
    const p = await requestNotificationPermission();
    setPermission(p);
    if (p === "granted") toast.success("Notifications enabled");
    else if (p === "denied") toast.error("Notifications blocked in your browser");
  };

  // Build month grid (6 weeks x 7 days)
  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      const d = new Date(s.scheduled_at);
      const key = dayKey(d);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [schedules]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const openAddForDay = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setAddDate(`${y}-${m}-${day}`);
    setAddOpen(true);
  };

  const upcoming = useMemo(
    () =>
      schedules
        .filter((s) => new Date(s.scheduled_at).getTime() >= Date.now() - 60_000)
        .slice(0, 6),
    [schedules],
  );
  const uniquePeople = useMemo(
    () => new Set(schedules.map((s) => s.user_name)).size,
    [schedules],
  );
  const people = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of schedules) m.set(s.user_name, (m.get(s.user_name) ?? 0) + 1);
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [schedules]);
  const selectedItems = byDay.get(dayKey(selectedDay)) ?? [];


  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50/50">
      {/* animated 3D ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <img
          src={bg3d}
          alt=""
          aria-hidden="true"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover opacity-[0.14] animate-float-slow scale-110"
        />
        <div className="absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full bg-indigo-400/25 blur-3xl animate-aurora" />
        <div className="absolute -bottom-52 -right-24 h-[38rem] w-[38rem] rounded-full bg-fuchsia-400/25 blur-3xl animate-aurora [animation-delay:-6s]" />
        <div className="absolute top-1/3 left-1/2 h-[30rem] w-[30rem] rounded-full bg-sky-300/20 blur-3xl animate-aurora [animation-delay:-12s]" />
      </div>

      <header className="shrink-0 border-b border-white/60 bg-white/70 backdrop-blur-2xl z-20 shadow-[0_10px_30px_-24px_hsl(255_60%_35%/0.6)]">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">

          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
              <CalendarClock className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight">CallCal</h1>
              <p className="text-[10.5px] text-neutral-500">Shared team calendar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs shadow-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
                style={{ background: colorFor(name).dot }}
              />
              <span className="font-medium text-neutral-700">{name}</span>
            </div>
            {permission === "granted" ? (
              <Badge
                variant="outline"
                className="gap-1 text-emerald-700 border-emerald-200 bg-emerald-50"
              >
                <Bell className="h-3 w-3" /> Alerts on
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={enableNotifications}
                className="rounded-full"
              >
                <BellOff className="h-4 w-4 mr-1" /> Enable alerts
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onLeave}
              title="Change name"
              className="rounded-full"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full px-3 sm:px-5 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_336px] gap-4 lg:gap-5">
        <section className="min-h-0 flex flex-col">
          {/* compact 3D hero / toolbar */}
          <div
            className="relative mb-4 shrink-0 overflow-hidden rounded-3xl border border-white/70"
            style={{
              boxShadow:
                "0 26px 55px -26px hsl(255 70% 40% / 0.55), 0 2px 0 0 #fff inset, 0 -14px 30px -22px hsl(300 70% 55% / 0.35) inset",
              transform: "perspective(1400px) rotateX(1.2deg)",
            }}
          >
            <img
              src={calendarBanner}
              alt="3D illustration of floating calendar cards, a clock and reminder badges"
              width={1600}
              height={512}
              className="h-28 sm:h-32 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/85 via-neutral-950/45 to-neutral-950/10" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.18)_50%,transparent_65%)]" />
            <div className="absolute inset-0 flex items-center justify-between gap-4 px-5 sm:px-7 text-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/75">
                  <Sparkles className="h-3.5 w-3.5" /> {monthLabel}
                </div>
                <h2
                  className="text-xl sm:text-3xl font-semibold tracking-tight mt-0.5 truncate"
                  style={{ textShadow: "0 6px 18px hsl(260 60% 10% / 0.55)" }}
                >
                  Hi {name}, here&apos;s what&apos;s coming up
                </h2>
                <p className="text-[11px] sm:text-xs text-white/75 mt-1">
                  {schedules.length} calls · {uniquePeople} people · click any day to schedule
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center rounded-full border border-white/25 bg-white/15 backdrop-blur-md p-0.5 shadow-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-white hover:bg-white/20 hover:text-white transition-transform hover:-translate-x-0.5"
                    onClick={() => setCursor(addMonths(cursor, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs font-medium text-white hover:bg-white/20 hover:text-white"
                    onClick={() => {
                      setCursor(startOfMonth(new Date()));
                      setSelectedDay(new Date());
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-white hover:bg-white/20 hover:text-white transition-transform hover:translate-x-0.5"
                    onClick={() => setCursor(addMonths(cursor, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="rounded-full border-0 bg-gradient-to-r from-indigo-500 to-fuchsia-500 shadow-[0_12px_24px_-12px_hsl(280_80%_45%/0.9)] hover:opacity-95 hover:-translate-y-0.5 transition-transform"
                  onClick={() => openAddForDay(selectedDay)}
                >
                  <Plus className="h-4 w-4 mr-1" /> New call
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 rounded-[28px] border border-white/70 bg-white/60 backdrop-blur animate-pulse" />
          ) : (
            <div
              className="flex-1 min-h-0 flex flex-col rounded-[28px] border border-white/70 bg-white/80 backdrop-blur-xl overflow-hidden scene-3d animate-breathe-3d"
              style={{
                boxShadow:
                  "0 60px 110px -40px hsl(255 60% 32% / 0.6), 0 24px 44px -26px hsl(300 60% 45% / 0.4), 0 2px 0 0 #fff inset, 0 -18px 40px -30px hsl(255 60% 40% / 0.5) inset",
              }}
            >

              <div
                className="grid grid-cols-7 shrink-0 border-b border-neutral-200/70 text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(250 60% 98%), hsl(250 30% 94%))",
                  boxShadow: "0 1px 0 0 #fff inset, 0 -6px 12px -10px hsl(255 50% 40% / 0.4) inset",
                }}
              >
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={`px-3 py-2.5 text-center ${
                      i === 0 || i === 6 ? "text-indigo-500" : ""
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-7 auto-rows-min">
                  {cells.map((d, i) => {
                    const inMonth = d.getMonth() === cursor.getMonth();

                    const key = dayKey(d);
                    const items = byDay.get(key) ?? [];
                    const isToday = isSameDay(d, today);
                    const isSelected = isSameDay(d, selectedDay);
                    const isLastCol = (i + 1) % 7 === 0;
                    const isLastRow = i >= 35;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedDay(d)}
                        className={`group flex flex-col min-h-[104px] p-1.5 relative cursor-pointer tile-3d animate-tile-in hover:z-20 hover:[transform:perspective(900px)_translateY(-5px)_rotateX(5deg)_scale(1.03)] hover:shadow-[0_28px_44px_-24px_hsl(255_60%_32%/0.75),0_1px_0_0_#fff_inset] ${
                          !isLastCol ? "border-r border-neutral-200/60" : ""
                        } ${!isLastRow ? "border-b border-neutral-200/60" : ""} ${
                          inMonth
                            ? isWeekend
                              ? "bg-[linear-gradient(180deg,hsl(250_40%_98.5%),hsl(250_25%_96%))]"
                              : "bg-[linear-gradient(180deg,#fff,hsl(250_30%_98.5%))]"
                            : "bg-[linear-gradient(180deg,hsl(250_15%_97%),hsl(250_12%_95%))] text-neutral-400"
                        } ${isSelected ? "z-10" : ""}`}
                        style={{
                          animationDelay: `${Math.min(i, 27) * 14}ms`,
                          boxShadow: isSelected
                            ? "0 0 0 2px hsl(255 80% 65% / 0.55) inset, 0 18px 32px -18px hsl(255 60% 40% / 0.6), 0 1px 0 0 #fff inset"
                            : "0 1px 0 0 hsl(0 0% 100% / 0.9) inset",
                        }}
                      >
                        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2px]">
                          <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 group-hover:opacity-100 group-hover:[animation:sheen-sweep_0.9s_ease-out]" />
                        </span>

                        {inMonth && items.length === 0 && (
                          <img
                            src={day3d}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            width={512}
                            height={512}
                            className="pointer-events-none absolute bottom-1.5 right-1.5 h-10 w-10 opacity-0 group-hover:opacity-80 transition-all duration-300 drop-shadow-lg group-hover:animate-float-y"
                          />
                        )}

                        <div className="flex items-center justify-between mb-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay(d);
                            }}
                            className={`text-xs font-semibold rounded-full h-6 w-6 flex items-center justify-center transition-transform hover:scale-105 ${
                              isToday
                                ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white animate-today-glow"
                                : inMonth
                                ? "text-neutral-700 hover:bg-white hover:shadow-[0_4px_10px_-6px_hsl(255_50%_35%/0.6)]"
                                : "text-neutral-400 hover:bg-neutral-100"
                            }`}
                          >
                            {d.getDate()}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddForDay(d);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition text-neutral-400 hover:text-indigo-600 h-6 w-6 flex items-center justify-center rounded-full hover:bg-white shadow-sm"
                            title="Add call"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1 pr-0.5">
                          {items.map((s, idx) => {
                            const c = colorFor(s.user_name);
                            const t = new Date(s.scheduled_at).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            });
                            const label = s.company_name || "Interview";
                            return (
                              <button
                                key={s.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetail(s);
                                }}
                                className="w-full text-left rounded-lg pl-1.5 pr-1.5 py-0.5 text-[10px] leading-tight border transition-all duration-200 hover:[transform:perspective(700px)_rotateX(-9deg)_translateY(-3px)_scale(1.045)] active:translate-y-0 relative overflow-hidden animate-pill-rise [transform-style:preserve-3d]"
                                style={{
                                  background: c.soft,
                                  borderColor: c.border,
                                  color: c.text,
                                  animationDelay: `${Math.min(idx, 6) * 35}ms`,
                                  boxShadow: `0 2px 0 0 ${c.ring}, 0 6px 10px -7px ${c.ring}, 0 1px 0 0 hsl(0 0% 100% / 0.85) inset`,
                                }}
                                title={`${label} · ${t} · scheduled by ${s.user_name} · interviewer ${s.interviewer || "—"}`}
                              >
                                <span
                                  className="absolute left-0 top-0 bottom-0 w-1"
                                  style={{ background: c.gradient }}
                                />
                                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent" />
                                <span className="pointer-events-none absolute inset-0 overflow-hidden">
                                  <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-0 group-hover:opacity-100 group-hover:[animation:sheen-sweep_1.1s_ease-out]" />
                                </span>

                                <div className="relative flex items-center gap-1 truncate pl-1.5">
                                  <span
                                    className="h-3.5 w-3.5 shrink-0 rounded-full text-[7px] font-bold text-white flex items-center justify-center shadow-[0_2px_3px_-1px_rgba(0,0,0,0.35),0_1px_0_0_hsl(0_0%_100%/0.5)_inset]"
                                    style={{ background: c.gradient }}
                                  >
                                    {s.user_name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="font-semibold shrink-0 tabular-nums">
                                    {t}
                                  </span>
                                  <span className="truncate opacity-90">{label}</span>
                                </div>
                                <div className="relative flex items-center gap-1 pl-1.5 mt-0.5">
                                  <PlatformBadge link={s.meeting_link} size="xs" />
                                  {s.interviewer && (
                                    <span className="truncate opacity-70 text-[9px]">
                                      👤 {s.interviewer}
                                    </span>
                                  )}
                                </div>

                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ---------- Sidebar ---------- */}
        <aside className="min-h-0 lg:overflow-y-auto lg:pr-1 space-y-4 pb-2 animate-tilt-in [animation-delay:120ms]">
          <Card className="p-4 border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_24px_50px_-32px_hsl(255_60%_35%/0.7),0_1px_0_0_#fff_inset] rounded-2xl">

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold">
                  {isSameDay(selectedDay, today)
                    ? "Today"
                    : selectedDay.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-full text-xs"
                onClick={() => openAddForDay(selectedDay)}
              >
                <Plus className="h-3.5 w-3.5 mr-0.5" /> Add
              </Button>
            </div>
            {selectedItems.length === 0 ? (
              <div className="text-xs text-neutral-500 py-5 text-center border border-dashed border-neutral-200 rounded-xl">
                <img
                  src={emptyDay}
                  alt="Empty calendar illustration"
                  width={640}
                  height={640}
                  loading="lazy"
                  className="mx-auto h-24 w-24 object-contain opacity-90"
                />
                Nothing scheduled.
                <br />
                <button
                  onClick={() => openAddForDay(selectedDay)}
                  className="text-indigo-600 hover:underline font-medium mt-1 inline-block"
                >
                  Schedule a call →
                </button>
              </div>

            ) : (
              <ul className="space-y-2">
                {selectedItems.map((s) => {
                  const c = colorFor(s.user_name);
                  const t = new Date(s.scheduled_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <li key={s.id} className="relative">
                      <button
                        onClick={() => setDetail(s)}
                        className="w-full text-left rounded-xl border p-2.5 hover:shadow-md transition flex gap-2.5 items-start"
                        style={{ background: c.soft, borderColor: c.border }}
                      >
                        <div
                          className="mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow"
                          style={{ background: c.gradient }}
                        >
                          {t.replace(/\s?(AM|PM)/i, "")}
                        </div>
                        <div className="min-w-0 flex-1 pr-7">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{ color: c.text }}
                          >
                            {s.company_name || "Interview"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <PlatformBadge link={s.meeting_link} size="xs" />
                            <span className="text-[11px] text-neutral-500 truncate">
                              {s.interviewer ? `${s.interviewer} · ` : ""}by {s.user_name} · {t}
                            </span>
                          </div>

                        </div>
                      </button>
                      <button
                        title="Add to my calendar"
                        aria-label="Add to my calendar"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadIcs({
                            title: s.title,
                            scheduled_at: s.scheduled_at,
                            meeting_link: s.meeting_link,
                            company_name: s.company_name,
                            company_info: s.company_info,
                            interviewer: s.interviewer,
                            user_name: s.user_name,
                          });
                          toast.success("Added — calendar file downloaded");
                        }}
                        className="absolute top-2 right-2 h-6 w-6 rounded-md bg-white/80 border border-neutral-200 text-indigo-600 flex items-center justify-center hover:bg-white hover:shadow transition"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                      </button>
                    </li>

                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-4 rounded-2xl border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_24px_50px_-32px_hsl(255_60%_35%/0.7),0_1px_0_0_#fff_inset]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-fuchsia-600" />
              <h3 className="text-sm font-semibold">Upcoming</h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-xs text-neutral-500">No upcoming calls.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((s) => {
                  const c = colorFor(s.user_name);
                  const d = new Date(s.scheduled_at);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setDetail(s)}
                        className="w-full text-left flex items-center gap-2.5 group"
                      >
                        <span
                          className="h-9 w-9 rounded-lg flex flex-col items-center justify-center text-white text-[9px] leading-tight font-bold shadow shrink-0"
                          style={{ background: c.gradient }}
                        >
                          <span className="uppercase opacity-80">
                            {d.toLocaleDateString(undefined, { month: "short" })}
                          </span>
                          <span className="text-sm -mt-0.5">{d.getDate()}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate text-neutral-800 group-hover:text-indigo-600 transition">
                            {s.company_name || "Interview"}
                          </div>
                          <div className="text-[10.5px] text-neutral-500 truncate">
                            {d.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}{" "}
                            · {s.user_name}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-4 rounded-2xl border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_24px_50px_-32px_hsl(255_60%_35%/0.7),0_1px_0_0_#fff_inset]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold">People &amp; colors</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const c = colorFor(p.name);
                return (
                  <span
                    key={p.name}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{ background: c.soft, borderColor: c.border, color: c.text }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: c.dot }}
                    />
                    {p.name}
                    <span className="opacity-60 tabular-nums">{p.count}</span>
                  </span>
                );
              })}
              {people.length === 0 && (
                <p className="text-xs text-neutral-500">No calls yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-white/20 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_28px_50px_-24px_hsl(280_80%_45%/0.85),0_1px_0_0_hsl(0_0%_100%/0.4)_inset] relative overflow-hidden">

            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Team activity</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-2xl font-bold tabular-nums">{schedules.length}</div>
                <div className="text-[10.5px] uppercase tracking-wider opacity-80">
                  Total calls
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{uniquePeople}</div>
                <div className="text-[10.5px] uppercase tracking-wider opacity-80">
                  Teammates
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </main>

      <AddScheduleDialog
        userName={name}
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setEditing(null);
        }}
        initialDate={addDate}
        editing={editing}
      />

      <EventDetailDialog
        schedule={detail}
        currentUser={name}
        onClose={() => setDetail(null)}
        onEdit={(s) => {
          setDetail(null);
          setEditing(s);
          setAddOpen(true);
        }}
      />
    </div>
  );
}

/* ---------------- Company info parser ---------------- */

function parseCompanyInfo(raw: string): Array<{ label: string; value: string }> {
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ label: string; value: string }> = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z ]{1,20}):\s*(.+)$/);
    if (m) out.push({ label: m[1], value: m[2] });
  }
  return out;
}

/* ---------------- Event detail dialog ---------------- */

function EventDetailDialog({
  schedule,
  currentUser,
  onClose,
  onEdit,
}: {
  schedule: Schedule | null;
  currentUser: string;
  onClose: () => void;
  onEdit: (s: Schedule) => void;
}) {
  if (!schedule) return null;
  const start = new Date(schedule.scheduled_at);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const c = colorFor(schedule.user_name);
  const canDelete = schedule.user_name === currentUser;
  const infoRows = parseCompanyInfo(schedule.company_info ?? "");
  const platform = platformOf(schedule.meeting_link);

  const handleDelete = async () => {
    if (!confirm(`Delete "${schedule.title}"?`)) return;
    const { error } = await supabase.from("schedules").delete().eq("id", schedule.id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted");
      onClose();
    }
  };

  const initials = (name: string) => name.slice(0, 1).toUpperCase();

  return (
    <Dialog open={!!schedule} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border border-white/60 bg-white/90 backdrop-blur-2xl shadow-[0_28px_70px_-28px_hsl(255_60%_35%/0.55)]">
        {/* 3D hero header */}
        <div
          className="relative h-36"
          style={{ background: platform?.gradient ?? c.gradient }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.12)_50%,transparent_100%)]" />
          <div className="absolute inset-0 opacity-20 mix-blend-overlay">
            <img
              src={calendarBanner}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>

          {/* Floating 3D platform icon */}
          <div className="absolute -bottom-8 left-6 flex items-center justify-center">
            <div
              className="h-18 w-18 rounded-3xl bg-white p-1.5 shadow-[0_18px_45px_-12px_rgba(0,0,0,0.25)] border border-white/80 tile-3d hover:tile-3d-hover"
              style={{ transform: "perspective(900px)" }}
            >
              {platform ? (
                <img
                  src={platform.icon}
                  alt={platform.label}
                  className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
                />
              ) : (
                <div
                  className="h-full w-full rounded-2xl flex items-center justify-center"
                  style={{ background: c.soft }}
                >
                  <CalendarClock className="h-8 w-8" style={{ color: c.text }} />
                </div>
              )}
            </div>
          </div>

          {/* 3D action chips */}
          <div className="absolute top-3 right-3 flex gap-2">
            <div className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-semibold shadow-sm">
              {dateStr}
            </div>
            <div className="px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-md border border-white/30 text-white text-[10px] font-semibold shadow-sm">
              {timeStr}
            </div>
          </div>
        </div>

        <div className="px-6 pt-12 pb-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-2xl font-bold tracking-tight pr-8 text-neutral-900">
              {schedule.company_name || schedule.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* People row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="relative overflow-hidden rounded-2xl border px-3 py-3 tile-3d hover:tile-3d-hover"
                style={{ background: c.soft, borderColor: c.border, color: c.text }}
              >
                <div className="absolute inset-0 sheen pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full hover:animate-sheen" />
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 rounded-full items-center justify-center text-white text-sm font-bold shadow-md"
                    style={{ background: c.gradient }}
                  >
                    {initials(schedule.user_name)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
                      Scheduled by
                    </div>
                    <div className="font-semibold truncate">{schedule.user_name}</div>
                  </div>
                </div>
              </div>

              {schedule.interviewer ? (
                <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-neutral-800 tile-3d hover:tile-3d-hover">
                  <div className="absolute inset-0 sheen pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full hover:animate-sheen" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold shadow-md">
                      {initials(schedule.interviewer)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                        Interviewer
                      </div>
                      <div className="font-semibold truncate">{schedule.interviewer}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-neutral-500 text-sm flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  No interviewer set
                </div>
              )}
            </div>

            {/* Meeting link card */}
            {schedule.meeting_link ? (
              <div
                className="relative overflow-hidden rounded-2xl border p-4 tile-3d hover:tile-3d-hover group"
                style={{
                  background: platform?.soft ?? "hsl(250 60% 97%)",
                  borderColor: platform?.color ?? "hsl(250 30% 88%)",
                }}
              >
                <div className="absolute inset-0 sheen pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-sheen" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <PlatformBadge link={schedule.meeting_link} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                        Meeting link
                      </span>
                    </div>
                    <a
                      href={schedule.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:underline break-all"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                      {schedule.meeting_link}
                    </a>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 border-0 shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all"
                  >
                    <a href={schedule.meeting_link} target="_blank" rel="noreferrer">
                      <Video className="h-4 w-4 mr-1" /> Join
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-500 text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0" />
                No meeting link added
              </div>
            )}

            {/* Company briefing */}
            {infoRows.length > 0 && (
              <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/80 p-4 tile-3d">
                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-neutral-700">
                  <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  Company briefing
                </div>
                <dl className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-[12.5px] leading-snug">
                  {infoRows.map((r) => (
                    <div key={r.label} className="contents">
                      <dt className="text-neutral-500 font-medium">{r.label}</dt>
                      <dd className="text-neutral-800">
                        {r.label.toLowerCase() === "website" ? (
                          <a
                            href={r.value.startsWith("http") ? r.value : `https://${r.value}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                          >
                            {r.value} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          r.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 pt-2.5 border-t border-neutral-200/70 text-[11px] text-neutral-500 flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Info generated by AI · verify before use
                </div>
              </div>
            )}

            {!infoRows.length && schedule.company_info && (
              <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/80 p-4 tile-3d">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-neutral-700">
                  <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  Company info
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {schedule.company_info}
                </p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-6 pt-4 border-t border-neutral-100">
            <div className="flex gap-2">
              <AddToCalendarButton schedule={schedule} size="sm" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(schedule)}
                className="rounded-full border-neutral-200 hover:bg-neutral-50 hover:-translate-y-0.5 transition-transform"
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:-translate-y-0.5 transition-transform"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-full border-neutral-200 hover:bg-neutral-50 sm:ml-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


/* ---------------- Add to calendar ---------------- */

function AddToCalendarButton({
  schedule,
  size = "default",
}: {
  schedule: Schedule;
  size?: "default" | "sm";
}) {
  const ev = {
    title: schedule.title,
    scheduled_at: schedule.scheduled_at,
    meeting_link: schedule.meeting_link,
    company_name: schedule.company_name,
    company_info: schedule.company_info,
    interviewer: schedule.interviewer,
    user_name: schedule.user_name,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarPlus className="h-4 w-4 mr-1" /> Add to calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">
            <CalendarDays className="h-4 w-4 mr-2" /> Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={outlookCalendarUrl(ev)} target="_blank" rel="noreferrer">
            <CalendarDays className="h-4 w-4 mr-2" /> Outlook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            downloadIcs(ev);
            toast.success("Calendar file downloaded");
          }}
        >
          <Download className="h-4 w-4 mr-2" /> Apple / .ics file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Add dialog ---------------- */


function AddScheduleDialog({
  userName,
  open,
  onOpenChange,
  initialDate,
  editing,
}: {
  userName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialDate: string;
  editing: Schedule | null;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [link, setLink] = useState("");
  const [picked, setPicked] = useState<PlatformId | null>(null);

  const [interviewer, setInterviewer] = useState("");
  const [company, setCompany] = useState("");
  const [companyInfo, setCompanyInfo] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const skipNextFetchRef = useRef(false);
  const fetchInfo = useServerFn(fetchCompanyInfo);
  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.scheduled_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setDate(`${y}-${m}-${day}`);
      setTime(`${hh}:${mm}`);
      setLink(editing.meeting_link);
      setInterviewer(editing.interviewer ?? "");
      setCompany(editing.company_name ?? "");
      setCompanyInfo(editing.company_info ?? "");
      skipNextFetchRef.current = true;
    } else {
      setDate(initialDate || new Date().toISOString().split("T")[0]);
    }
  }, [open, initialDate, editing]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const trimmed = company.trim();
    if (trimmed.length < 2) {
      setCompanyInfo("");
      setInfoLoading(false);
      return;
    }
    setInfoLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetchInfo({ data: { name: trimmed } });
        setCompanyInfo(res.info ?? "");
      } catch {
        setCompanyInfo("");
      } finally {
        setInfoLoading(false);
      }
    }, 700);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [company, fetchInfo]);

  const reset = () => {
    setTime("");
    setLink("");
    setInterviewer("");
    setCompany("");
    setCompanyInfo("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || !interviewer.trim()) {
      toast.error("Please fill in interviewer, date and time");
      return;
    }
    if (link.trim()) {
      try {
        new URL(link.trim());
      } catch {
        toast.error("Meeting link must be a valid URL");
        return;
      }
    }

    const scheduledAt = new Date(`${date}T${time}`);
    if (isNaN(scheduledAt.getTime())) {
      toast.error("Invalid date/time");
      return;
    }

    const derivedTitle = company.trim()
      ? `Interview · ${company.trim()}`
      : "Interview";

    setSaving(true);
    const payload = {
      title: derivedTitle.slice(0, 200),
      scheduled_at: scheduledAt.toISOString(),
      meeting_link: link.trim().slice(0, 500),
      interviewer: interviewer.trim().slice(0, 80),
      company_name: company.trim() ? company.trim().slice(0, 120) : null,
      company_info: companyInfo.trim() ? companyInfo.trim().slice(0, 2000) : null,
    };
    const { error } = isEdit && editing
      ? await supabase.from("schedules").update(payload).eq("id", editing.id)
      : await supabase.from("schedules").insert({ ...payload, user_name: userName });
    setSaving(false);

    if (error) {
      toast.error(isEdit ? "Failed to update" : "Failed to save");
      return;
    }
    toast.success(isEdit ? "Call updated" : "Call scheduled");
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      requestNotificationPermission();
    }
    onOpenChange(false);
    reset();
  };

  const infoRows = parseCompanyInfo(companyInfo);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
              {isEdit ? <Pencil className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4 text-white" />}
            </div>
            {isEdit ? "Edit call" : "New call"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-muted-foreground">
            {isEdit ? "Originally scheduled by " : "Scheduling as "}
            <span className="font-medium text-foreground">{isEdit && editing ? editing.user_name : userName}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Meeting app</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => {
                const active = (platformOf(link)?.id ?? picked) === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked(active ? null : p.id)}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-semibold flex flex-col items-center gap-1 transition-all duration-200 hover:-translate-y-0.5 ${
                      active ? "text-white" : "bg-white text-neutral-600"
                    }`}
                    style={{
                      background: active ? p.gradient : undefined,
                      borderColor: active ? p.color : "hsl(250 20% 88%)",
                      boxShadow: active
                        ? `0 10px 18px -12px ${p.color}, 0 1px 0 0 hsl(0 0% 100% / 0.5) inset`
                        : "0 2px 6px -5px hsl(255 40% 30% / 0.5)",
                    }}
                  >
                    <img src={p.icon} alt="" className="h-6 w-6 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
                    {p.short}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="link">Meeting link (optional)</Label>
            <Input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={
                PLATFORMS.find((p) => p.id === (platformOf(link)?.id ?? picked))
                  ?.placeholder ?? "https://meet.google.com/…"
              }
              maxLength={500}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="interviewer">Interviewer</Label>

            <Input
              id="interviewer"
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="Who will conduct this interview?"
              maxLength={80}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              maxLength={120}
              className="mt-1"
            />
            {(infoLoading || companyInfo) && (
              <div className="mt-2 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-fuchsia-50/40 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 mb-1.5">
                  <Sparkles
                    className={`h-3.5 w-3.5 ${infoLoading ? "animate-pulse" : ""}`}
                  />
                  {infoLoading ? "Researching company…" : "Company briefing"}
                </div>
                {infoLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-2.5 rounded bg-indigo-100/70 animate-pulse w-5/6" />
                    <div className="h-2.5 rounded bg-indigo-100/70 animate-pulse w-4/6" />
                    <div className="h-2.5 rounded bg-indigo-100/70 animate-pulse w-3/6" />
                  </div>
                ) : infoRows.length > 0 ? (
                  <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-[11.5px] leading-snug">
                    {infoRows.map((r) => (
                      <div key={r.label} className="contents">
                        <dt className="text-neutral-500 font-medium">{r.label}</dt>
                        <dd className="text-neutral-800">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[11.5px] text-neutral-600 leading-relaxed">
                    {companyInfo}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 border-0 shadow-md shadow-indigo-500/25"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add to calendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
