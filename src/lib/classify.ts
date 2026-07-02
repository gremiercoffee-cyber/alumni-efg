import {
  FlatFolder,
  AppSettings,
  PendingCapture,
  FolderNode,
  TodoList,
} from '../types';
import { flattenFolders } from '../utils';

interface ClassifyInput {
  transcript: string;
  folderList: FlatFolder[];
  todoLists: TodoList[];
  settings: AppSettings;
  openaiKey: string;
}

interface ClassifyKeeperInput {
  text: string;
  keeperTree: FolderNode;
  openaiKey: string;
  url?: string | null;
}

export interface KeeperClassification {
  title: string;
  summary: string;
  existingCategoryId: string | null;
  newCategorySuggestion: { parentId: string; name: string } | null;
}

function settingsContext(settings: AppSettings): string {
  return [
    settings.areas && `Life areas: ${settings.areas}`,
    settings.schedule && `Daily schedule: ${settings.schedule}`,
    settings.coffee && `Work and responsibilities: ${settings.coffee}`,
    settings.coffeePeople && `People they interact with: ${settings.coffeePeople}`,
    settings.yeshiva && `Recurring commitments: ${settings.yeshiva}`,
    settings.yeshivaPeople && `Important relationships: ${settings.yeshivaPeople}`,
    settings.urgency && `Urgency rules: ${settings.urgency}`,
    settings.vocabulary && `Vocabulary: ${settings.vocabulary}`,
    settings.privacy && `Privacy: ${settings.privacy}`,
  ].filter(Boolean).join('\n');
}

function folderContext(folderList: FlatFolder[], emptyLabel: string): string {
  return folderList.length
    ? folderList.map(f => `- id: ${f.id} | path: ${f.path.join(' > ')}`).join('\n')
    : emptyLabel;
}

function todoContext(todoLists: TodoList[], folderList: FlatFolder[]): string {
  if (!todoLists.length) return '(no running to-do lists exist yet)';

  return todoLists.map(list => {
    const folder = folderList.find(f => f.id === list.folderId);
    const openItems = list.items.filter(i => !i.done).map(i => `    - ${i.text}`).join('\n');
    return [
      `- id: ${list.id} | title: ${list.title} | folder: ${folder ? folder.path.join(' > ') : list.folderId}`,
      openItems || '    - no open items',
    ].join('\n');
  }).join('\n');
}

async function askOpenAI(openaiKey: string, system: string, user: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Classification failed: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('AI returned invalid JSON - try again.');
  }
}

export async function classifyNote({
  transcript,
  folderList,
  todoLists,
  settings,
  openaiKey,
}: ClassifyInput): Promise<Omit<PendingCapture, 'id' | 'transcript'>> {
  const folderDesc = folderContext(
    folderList,
    '(no folders exist yet - this may be the first capture)'
  );
  const todosDesc = todoContext(todoLists, folderList);
  const contextBlock = settingsContext(settings);

  const system = `You organize spoken captures for one person. Decide whether the transcript is a general note or an explicit running to-do list.

${contextBlock ? `Context about this person:\n${contextBlock}\n` : ''}
Existing note/to-do folders:
${folderDesc}

Existing running to-do lists:
${todosDesc}

Respond ONLY with raw JSON, no markdown fences, no preamble.

For a normal note, use exactly this shape:
{
  "contentType": "note",
  "title": "3-6 word title",
  "summary": "1-2 sentence summary",
  "existingFolderId": "id of best matching existing folder, or null",
  "newFolderSuggestion": { "parentId": "id of closest parent (use root if none fit)", "name": "new folder name" } or null,
  "actionItems": [
    { "text": "short action starting with a verb", "due": "natural language due date/time like 'Today, 5:00 PM' or 'Fri Jul 4' or null", "inferred": true }
  ]
}

For an explicit to-do dump, use exactly this shape:
{
  "contentType": "todo_items",
  "title": "3-6 word title for this task batch",
  "summary": "1 sentence summary",
  "existingFolderId": "id of best matching folder, or null",
  "newFolderSuggestion": { "parentId": "id of closest parent (use root if none fit)", "name": "new folder name" } or null,
  "existingTodoListId": "id of best matching running to-do list, or null",
  "newTodoListTitle": "short list title if no existing list fits, otherwise null",
  "todoItems": [
    { "text": "one concise sticky-note style task", "due": "natural language reminder suggestion like 'Today 5 PM', 'Tomorrow morning', 'Fri Jul 4 at 2 PM', or null" }
  ]
}

Rules:
- Use contentType "todo_items" only when the person is clearly rattling off tasks they need to do. Meeting recaps, thoughts, ideas, and summaries are notes even if they imply follow-up actions.
- For notes, infer action items when the content implies something needs to happen.
- For to-do items, split the transcript into discrete checklist items and do not also return actionItems.
- Every todoItems[].text must read like a handwritten list item or sticky note: shortest possible phrasing that still keeps the full intent.
- Remove filler and spoken framing such as "I need to", "don't forget to", "I should", "we need to", "I have to", "look into", and similar prefixes unless a word is truly required for meaning.
- If the core task is best expressed as a noun phrase, use a noun phrase. If it is best expressed as an action, use a short action phrase.
- Prefer compact phrasing such as "Tin foil", "Send Avi study materials", "Call bottle supplier re: pricing", "New keyboard for office".
- If the speaker says multiple tasks in one sentence or recording, return one array item per task. Never bundle X, Y, and Z into a single todoItems entry.
- For due dates, use urgency rules when provided. For to-do items, think of due as the best default reminder time suggestion. If no urgency is implied, leave due as null.
- Prefer an existing folder when it fits. If none fits, propose a new folder under the closest parent.
- For to-do items, prefer an existing running to-do list when it fits. Otherwise provide newTodoListTitle.
- Output strictly valid JSON only.`;

  return askOpenAI(
    openaiKey,
    system,
    `Transcript:\n"""\n${transcript}\n"""`
  );
}

export async function classifyKeeperItem({
  text,
  keeperTree,
  openaiKey,
  url,
}: ClassifyKeeperInput): Promise<KeeperClassification> {
  const keeperFolders = flattenFolders(keeperTree);
  const categoryDesc = folderContext(
    keeperFolders,
    '(no Keeper categories exist yet - create the first useful category)'
  );

  const system = `You organize saved things for a personal area called Keeper.

Existing Keeper categories:
${categoryDesc}

Respond ONLY with raw JSON, no markdown fences, no preamble, exactly this shape:
{
  "title": "short human-readable title",
  "summary": "one short summary",
  "existingCategoryId": "id of best matching Keeper category, or null",
  "newCategorySuggestion": { "parentId": "id of closest parent (use keeper-root if none fit)", "name": "new category name" } or null
}

Rules:
- Keeper categories are independent from notes and to-dos.
- A Keeper item may be a shared link, a typed thought, or a dictated thing the person wants to keep around.
- Use practical categories such as recipes, gift ideas, quotes, references, ideas, articles to read, shopping, or anything more specific that fits.
- Prefer an existing Keeper category if it fits well.
- If no category fits, suggest a concise new category.
- Output strictly valid JSON only.`;

  const user = url
    ? `Saved text:\n"""\n${text}\n"""\n\nURL:\n${url}`
    : `Saved text:\n"""\n${text}\n"""`;

  return askOpenAI(openaiKey, system, user);
}
