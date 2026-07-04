import { CalendarEvent, FolderNode, FlatFolder } from './types';
import { TODO_CATEGORY_PALETTE } from './constants';

export function flattenFolders(node: FolderNode, path: string[] = []): FlatFolder[] {
  const here: FlatFolder = {
    id: node.id,
    name: node.name,
    path: [...path, node.name],
  };
  let out: FlatFolder[] = [here];
  for (const c of node.children || []) {
    out = out.concat(flattenFolders(c, here.path));
  }
  return out;
}

export function findNode(node: FolderNode, id: string): FolderNode | null {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}

export function addChildFolder(
  tree: FolderNode,
  parentId: string,
  name: string,
  prefix = 'f',
  color?: string | null
): { tree: FolderNode; id: string } {
  const newTree: FolderNode = JSON.parse(JSON.stringify(tree));
  const parent = findNode(newTree, parentId) || newTree;
  const id =
    prefix + '-' +
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 6);
  parent.children = parent.children || [];
  parent.children.push({ id, name, children: [], color: color ?? null });
  return { tree: newTree, id };
}

export function countNotes(
  node: FolderNode,
  notesByFolder: Record<string, number>
): number {
  let total = notesByFolder[node.id] || 0;
  for (const c of node.children || []) {
    total += countNotes(c, notesByFolder);
  }
  return total;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function folderPathLabel(
  id: string,
  folders: FlatFolder[]
): string {
  const f = folders.find(f => f.id === id);
  if (!f) return 'Miscellaneous';
  const trail = f.path.slice(1); // drop "Everything"
  return trail.length ? trail.join(' / ') : f.name;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function findFolderByName(node: FolderNode, name: string): FolderNode | null {
  if (node.name.trim().toLowerCase() === name.trim().toLowerCase()) {
    return node;
  }
  for (const child of node.children || []) {
    const found = findFolderByName(child, name);
    if (found) return found;
  }
  return null;
}

export function renameFolder(
  tree: FolderNode,
  folderId: string,
  nextName: string
): FolderNode {
  const newTree: FolderNode = JSON.parse(JSON.stringify(tree));
  const target = findNode(newTree, folderId);
  if (target && target.id !== 'root') {
    target.name = nextName;
  }
  return newTree;
}

export function collectFolderIds(node: FolderNode, ids = new Set<string>()): Set<string> {
  ids.add(node.id);
  for (const child of node.children || []) {
    collectFolderIds(child, ids);
  }
  return ids;
}

export function deleteFolder(
  tree: FolderNode,
  folderId: string
): FolderNode {
  if (folderId === 'root') return tree;
  const newTree: FolderNode = JSON.parse(JSON.stringify(tree));

  const removeFrom = (node: FolderNode): boolean => {
    const index = (node.children || []).findIndex(child => child.id === folderId);
    if (index >= 0) {
      node.children.splice(index, 1);
      return true;
    }
    return (node.children || []).some(child => removeFrom(child));
  };

  removeFrom(newTree);
  return newTree;
}

export function ensureFolder(
  tree: FolderNode,
  folderName: string,
  parentId = 'root',
  color?: string | null
): { tree: FolderNode; id: string } {
  const existing = findFolderByName(tree, folderName);
  if (existing) {
    return { tree, id: existing.id };
  }
  return addChildFolder(tree, parentId, folderName, 'f', color);
}

export function assignCategoryColor(tree: FolderNode, folderId: string, color: string): FolderNode {
  const newTree: FolderNode = JSON.parse(JSON.stringify(tree));
  const target = findNode(newTree, folderId);
  if (target) target.color = color;
  return newTree;
}

export function nextCategoryColor(tree: FolderNode): string {
  const used = flattenFolders(tree)
    .map(folder => findNode(tree, folder.id)?.color)
    .filter((color): color is string => !!color);
  return TODO_CATEGORY_PALETTE[used.length % TODO_CATEGORY_PALETTE.length];
}

export function getFolderColor(tree: FolderNode, folderId: string | null | undefined): string | null {
  if (!folderId) return null;
  return findNode(tree, folderId)?.color || null;
}

export function tintColor(hex: string, alpha: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  return `#${clean}${alpha}`;
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[),.;!?]+$/, '') : null;
}

export function classifyDueBucket(due: string | null): 'today' | 'soon' | 'later' | null {
  if (!due) return null;
  const value = due.toLowerCase();
  if (
    value.includes('today') ||
    value.includes('tonight') ||
    value.includes('this morning') ||
    value.includes('this afternoon') ||
    value.includes('this evening')
  ) {
    return 'today';
  }
  if (
    value.includes('tomorrow') ||
    value.includes('mon ') ||
    value.includes('tue ') ||
    value.includes('wed ') ||
    value.includes('thu ') ||
    value.includes('fri ') ||
    value.includes('sat ') ||
    value.includes('sun ')
  ) {
    return 'soon';
  }
  return 'later';
}

export function formatReminderLabel(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function parseSuggestedReminder(input: string | null): number | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const directParsed = parseNaturalDateTime(input, null);
  if (directParsed && !directParsed.allDay) {
    return directParsed.startAt;
  }

  const now = new Date();
  const base = new Date(now);
  base.setSeconds(0, 0);
  base.setMinutes(Math.ceil(base.getMinutes() / 5) * 5);
  if (base <= now) {
    base.setMinutes(base.getMinutes() + 5);
  }

  const setTime = (date: Date, hours: number, minutes = 0) => {
    date.setHours(hours, minutes, 0, 0);
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }
    return date.getTime();
  };

  const weekdayMap: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  if (value.includes('asap')) return base.getTime();
  if (value.includes('today')) return setTime(new Date(now), 18, 0);
  if (value.includes('tonight')) return setTime(new Date(now), 20, 0);
  if (value.includes('this afternoon')) return setTime(new Date(now), 15, 0);
  if (value.includes('this evening')) return setTime(new Date(now), 19, 0);
  if (value.includes('tomorrow')) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return setTime(date, 9, 0);
  }

  for (const [label, day] of Object.entries(weekdayMap)) {
    if (value.includes(label)) {
      const date = new Date(now);
      const diff = (day - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + diff);
      return setTime(date, 9, 0);
    }
  }

  const absolute = Date.parse(input);
  return Number.isNaN(absolute) ? null : absolute;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function formatClockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function parseNaturalDateTime(
  dateText: string | null,
  timeText: string | null
): { startAt: number; endAt: number; allDay: boolean } | null {
  const now = new Date();
  const combined = [dateText, timeText].filter(Boolean).join(' ').trim();
  const direct = combined ? Date.parse(combined) : Number.NaN;
  if (!Number.isNaN(direct)) {
    const start = new Date(direct);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);
    return { startAt: start.getTime(), endAt: end.getTime(), allDay: false };
  }

  const baseDate = parseRelativeDate(dateText || combined) || startOfDay(now);
  if (!baseDate) return null;

  const time = parseTimeOfDay(timeText || combined);
  if (!time) {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startAt: start.getTime(), endAt: end.getTime(), allDay: true };
  }

  const start = new Date(baseDate);
  start.setHours(time.hours, time.minutes, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);
  return { startAt: start.getTime(), endAt: end.getTime(), allDay: false };
}

export function withDuration(
  parsed: { startAt: number; endAt: number; allDay: boolean },
  durationMinutes: number | null
): { startAt: number; endAt: number; allDay: boolean } {
  if (parsed.allDay || !durationMinutes || durationMinutes <= 0) return parsed;
  return {
    ...parsed,
    endAt: parsed.startAt + durationMinutes * 60 * 1000,
  };
}

export function eventOccursOnDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return event.startAt < dayEnd && event.endAt > dayStart;
}

function parseRelativeDate(input: string | null): Date | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;

  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) {
    return startOfDay(new Date(direct));
  }

  const lowered = value.toLowerCase();
  const today = startOfDay(new Date());
  if (lowered.includes('today')) return today;
  if (lowered.includes('tomorrow')) return addDays(today, 1);

  const weekdayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  for (const [label, day] of Object.entries(weekdayMap)) {
    if (lowered.includes(label)) {
      const next = new Date(today);
      const diff = (day - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + (diff === 0 ? 7 : diff));
      return next;
    }
  }

  return null;
}

function parseTimeOfDay(input: string | null): { hours: number; minutes: number } | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if (value.includes('morning')) return { hours: 9, minutes: 0 };
  if (value.includes('afternoon')) return { hours: 13, minutes: 0 };
  if (value.includes('evening')) return { hours: 18, minutes: 0 };
  if (value.includes('night')) return { hours: 20, minutes: 0 };

  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || '0');
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return { hours, minutes };
}
