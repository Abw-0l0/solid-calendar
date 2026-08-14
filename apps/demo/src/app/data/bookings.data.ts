/**
 * Deterministic booking generator.
 *
 * Every date produces the same bookings on every reload, because the demo is also
 * documentation: a screenshot in a docs page has to match what the reader sees, and a
 * date you navigate back to has to look the way it did when you left it. So no
 * `Math.random()` — a small hash of the date string seeds a linear congruential
 * generator instead.
 *
 * Two library defaults shape every object below, and both are easy to get wrong:
 *
 *   1. A `title` makes an event a TIME BLOCK, not a booking. The default
 *      `eventTypeResolver` is `raw => raw.title?.trim() ? 'timeblock' : 'event'`.
 *      A booking's label is built from its client and service instead.
 *   2. The assignee must be an OBJECT WITH AN ID. A flat `assignee_id: 's1'` resolves to
 *      nothing and the event is silently dropped from resource views.
 */
import { STAFF, ROOMS } from './resources.data';

export interface RawBooking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  /** Present only on time blocks. */
  title?: string;
  assignee?: { id: string; color?: string };
  /** Time blocks may span several people at once. */
  assignees?: Array<{ id: string; color?: string }>;
  client?: { name: string };
  service?: { name: string };
  secondaryResources?: Array<{ id: string }>;
  group_id?: string;
  status: 'Active' | 'Cancelled' | 'Completed';
}

const CLIENTS = [
  'J. Ferreira', 'M. Novak', 'P. Adeyemi', 'R. Haugen', 'T. Marchetti',
  'N. Duarte', 'K. Yamamoto', 'S. Bergstrom', 'L. Okafor', 'A. Kowalski',
  'D. Rossi', 'H. Andersen', 'C. Mwangi', 'V. Petrova', 'B. Tremblay',
];

const SERVICES = [
  { name: 'Initial consult', minutes: 60 },
  { name: 'Follow-up', minutes: 30 },
  { name: 'Assessment', minutes: 90 },
  { name: 'Review', minutes: 40 },
  { name: 'Studio session', minutes: 60 },
  { name: 'Quick check', minutes: 20 },
];

/** FNV-1a over the date string. Stable across runs and platforms, unlike hashCode tricks. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Park-Miller LCG. Deterministic, and good enough to look unplanned.
 *
 * Two details that both have to be right, because every call site here is
 * `arr[Math.floor(rand() * arr.length)]` and both failure modes index out of bounds:
 *
 * 1. Plain multiplication, NOT `Math.imul`. imul truncates to a *signed* 32-bit result,
 *    and `state * 16807` overflows that badly — so it periodically returns a negative
 *    state, then a negative float, then a negative index. `16807 * 2147483646` is about
 *    3.6e13, comfortably inside the 2^53 range where Number multiplication is exact, so
 *    the plain form is both correct and faster.
 * 2. Divide by the modulus, not the modulus minus one. `state` lands in [1, 2147483646],
 *    so this gives a half-open [0, 1). Dividing by 2147483646 would make it inclusive of
 *    1, and the one state that hits it indexes one past the end.
 *
 * Neither is hypothetical: with both bugs present, today's date threw inside
 * `fetchEvents` and every grid on the site rendered empty.
 */
function rng(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const toTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Day of week without constructing a local-time Date, which is unsafe near midnight. */
function weekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Bookings for one date. Sunday is closed, so it returns nothing — which is itself worth
 * seeing, since an empty column against closed shading is a real state.
 */
export function bookingsForDate(dateStr: string): RawBooking[] {
  const dow = weekday(dateStr);
  if (dow === 0) return [];

  const random = rng(hash(dateStr));
  const events: RawBooking[] = [];
  const saturday = dow === 6;

  for (const staff of STAFF) {
    // Saturday is a short day for everyone, so fewer bookings land on it.
    const count = saturday ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 4);

    let cursor = (saturday ? 10 : 9) * 60 + Math.floor(random() * 4) * 15;

    for (let i = 0; i < count; i++) {
      const service = SERVICES[Math.floor(random() * SERVICES.length)];
      const client = CLIENTS[Math.floor(random() * CLIENTS.length)];
      const start = cursor;
      const end = start + service.minutes;

      if (end > (saturday ? 14 : 18) * 60) break;

      const id = `bk-${dateStr}-${staff.id}-${i}`;

      // Roughly one in twelve is cancelled: struck through, and neither draggable nor
      // resizable. The default statusResolver keys off exactly this string.
      const cancelled = random() < 0.08;
      // One in fourteen is completed. `blockedStatuses` on DragPersistencePlugin is what
      // makes these immovable too — the calendar itself has no opinion about them.
      const completed = !cancelled && random() < 0.07;

      events.push({
        id,
        date: dateStr,
        start_time: toTime(start),
        end_time: toTime(end),
        assignee: { id: staff.id, color: staff.color },
        client: { name: client },
        service: { name: service.name },
        status: cancelled ? 'Cancelled' : completed ? 'Completed' : 'Active',
        ...(random() < 0.25
          ? { secondaryResources: [{ id: ROOMS[Math.floor(random() * ROOMS.length)].id }] }
          : {}),
      });

      // Deliberately step back sometimes so bookings overlap and the layout engine has
      // something to do. Without this the grid never shows side-by-side columns.
      cursor = end + (random() < 0.3 ? -20 : Math.floor(random() * 3) * 15);
    }
  }

  // A grouped booking: two rows sharing a group_id render with a connector and a shared
  // colour, which is how a multi-part appointment reads as one thing.
  if (dow === 2 || dow === 4) {
    const groupId = `grp-${dateStr}`;
    events.push(
      {
        id: `${groupId}-a`, date: dateStr, start_time: '15:00', end_time: '15:45',
        assignee: { id: 's1' }, client: { name: 'W. Ibrahim' }, service: { name: 'Fitting (part 1)' },
        group_id: groupId, status: 'Active',
      },
      {
        id: `${groupId}-b`, date: dateStr, start_time: '15:45', end_time: '16:30',
        assignee: { id: 's2' }, client: { name: 'W. Ibrahim' }, service: { name: 'Fitting (part 2)' },
        group_id: groupId, status: 'Active',
      },
    );
  }

  return [...events, ...blocksForDate(dateStr)];
}

/**
 * Time blocks: breaks and maintenance, distinct from bookings because they carry a
 * `title`. The multi-owner one fans out to a copy per person in resource views and
 * collapses to the first owner with a `multipleResources` suffix in flat views.
 */
export function blocksForDate(dateStr: string): RawBooking[] {
  const dow = weekday(dateStr);
  if (dow === 0) return [];

  const blocks: RawBooking[] = [
    {
      id: `lunch-${dateStr}`,
      date: dateStr,
      start_time: '12:00',
      end_time: '13:00',
      title: 'Lunch',
      assignees: STAFF.slice(0, 3).map((s) => ({ id: s.id })),
      status: 'Active',
    },
  ];

  if (dow === 3) {
    blocks.push({
      id: `maint-${dateStr}`,
      date: dateStr,
      start_time: '16:00',
      end_time: '17:30',
      title: 'Equipment maintenance',
      assignee: { id: 's4' },
      status: 'Active',
    });
  }

  if (dow === 1) {
    blocks.push({
      id: `standup-${dateStr}`,
      date: dateStr,
      start_time: '09:00',
      end_time: '09:30',
      title: 'Team standup',
      assignees: STAFF.map((s) => ({ id: s.id })),
      status: 'Active',
    });
  }

  return blocks;
}

/** Every booking in a range, inclusive of both ends. What `fetchEvents` is handed. */
export function bookingsInRange(start: string, end: string): RawBooking[] {
  const events: RawBooking[] = [];
  let cursor = start;
  // Bounded so a malformed range cannot spin: no view spans more than about six weeks.
  for (let guard = 0; cursor <= end && guard < 60; guard++) {
    events.push(...bookingsForDate(cursor));
    const [y, m, d] = cursor.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cursor = next.toISOString().slice(0, 10);
  }
  return events;
}
