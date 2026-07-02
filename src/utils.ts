import { FolderNode, FlatFolder } from './types';

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
  prefix = 'f'
): { tree: FolderNode; id: string } {
  const newTree: FolderNode = JSON.parse(JSON.stringify(tree));
  const parent = findNode(newTree, parentId) || newTree;
  const id =
    prefix + '-' +
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 6);
  parent.children = parent.children || [];
  parent.children.push({ id, name, children: [] });
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
  parentId = 'root'
): { tree: FolderNode; id: string } {
  const existing = findFolderByName(tree, folderName);
  if (existing) {
    return { tree, id: existing.id };
  }
  return addChildFolder(tree, parentId, folderName);
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
