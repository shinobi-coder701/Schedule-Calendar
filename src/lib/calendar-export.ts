export type CalendarEvent = {
  title: string;
  scheduled_at: string;
  meeting_link?: string | null;
  company_name?: string | null;
  company_info?: string | null;
  interviewer?: string | null;
  user_name?: string | null;
  durationMinutes?: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC timestamp in iCal / Google format: 20260821T004100Z */
function toStamp(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function eventRange(e: CalendarEvent) {
  const start = new Date(e.scheduled_at);
  const end = new Date(start.getTime() + (e.durationMinutes ?? 30) * 60_000);
  return { start, end };
}

export function eventTitle(e: CalendarEvent) {
  return e.title?.trim() || (e.company_name ? `${e.company_name} interview` : "Interview");
}

export function eventDescription(e: CalendarEvent) {
  const lines: string[] = [];
  if (e.interviewer) lines.push(`Interviewer: ${e.interviewer}`);
  if (e.user_name) lines.push(`Scheduled by: ${e.user_name}`);
  if (e.company_name) lines.push(`Company: ${e.company_name}`);
  if (e.meeting_link) lines.push(`Meeting link: ${e.meeting_link}`);
  if (e.company_info) lines.push("", e.company_info);
  return lines.join("\n");
}

/** Google Calendar "add event" URL — opens a prefilled event the user just saves. */
export function googleCalendarUrl(e: CalendarEvent) {
  const { start, end } = eventRange(e);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(e),
    dates: `${toStamp(start)}/${toStamp(end)}`,
    details: eventDescription(e),
  });
  if (e.meeting_link) params.set("location", e.meeting_link);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook / Office 365 web "compose event" URL. */
export function outlookCalendarUrl(e: CalendarEvent) {
  const { start, end } = eventRange(e);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: eventTitle(e),
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: eventDescription(e),
  });
  if (e.meeting_link) params.set("location", e.meeting_link);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(e: CalendarEvent) {
  const { start, end } = eventRange(e);
  const uid = `${start.getTime()}-${Math.random().toString(36).slice(2)}@call-calendar`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Call Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toStamp(new Date())}`,
    `DTSTART:${toStamp(start)}`,
    `DTEND:${toStamp(end)}`,
    `SUMMARY:${escapeIcs(eventTitle(e))}`,
    `DESCRIPTION:${escapeIcs(eventDescription(e))}`,
    ...(e.meeting_link ? [`LOCATION:${escapeIcs(e.meeting_link)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(eventTitle(e))}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Downloads an .ics file — works for Apple Calendar, Outlook desktop, etc. */
export function downloadIcs(e: CalendarEvent) {
  const blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventTitle(e).replace(/[^\w\-]+/g, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
