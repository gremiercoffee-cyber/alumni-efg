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
