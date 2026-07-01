import { FlatFolder, AppSettings, PendingNote } from '../types';

interface ClassifyInput {
  transcript: string;
  folderList: FlatFolder[];
  settings: AppSettings;
  openaiKey: string;
}

export async function classifyNote({
  transcript,
  folderList,
  settings,
  openaiKey,
}: ClassifyInput): Promise<Omit<PendingNote, 'id' | 'transcript'>> {
  const folderDesc = folderList.length
    ? folderList.map(f => `- id: ${f.id} | path: ${f.path.join(' > ')}`).join('\n')
    : '(no folders exist yet — this may be the first note)';

  const contextBlock = [
    settings.areas && `Life areas: ${settings.areas}`,
    settings.schedule && `Daily schedule: ${settings.schedule}`,
    settings.coffee && `Coffee business: ${settings.coffee}`,
    settings.coffeePeople && `Coffee people: ${settings.coffeePeople}`,
    settings.yeshiva && `Yeshiva: ${settings.yeshiva}`,
    settings.yeshivaPeople && `Yeshiva people: ${settings.yeshivaPeople}`,
    settings.urgency && `Urgency rules: ${settings.urgency}`,
    settings.vocabulary && `Vocabulary: ${settings.vocabulary}`,
    settings.privacy && `Privacy: ${settings.privacy}`,
  ].filter(Boolean).join('\n');

  const system = `You are a note-organizing assistant for a specific person. Read a voice transcript, file it into the right folder, extract implicit action items, and suggest realistic reminder times.

${contextBlock ? `Context about this person:\n${contextBlock}\n` : ''}
Existing folders:
${folderDesc}

Respond ONLY with raw JSON — no markdown fences, no preamble — exactly this shape:
{
  "title": "3-6 word title",
  "summary": "1-2 sentence summary",
  "existingFolderId": "id of best matching existing folder, or null",
  "newFolderSuggestion": { "parentId": "id of closest parent (use root if none fit)", "name": "new folder name" } or null,
  "actionItems": [
    { "text": "short action starting with a verb", "due": "natural language due date/time like 'Today, 5:00 PM' or 'Fri Jul 4' or null", "inferred": true }
  ]
}

Rules:
- Infer action items from the content — don't wait for the person to say "action item". If the conversation implies something needs to happen, flag it.
- For due dates: use the urgency rules above if provided. If something sounds pressing, suggest today or tomorrow. If no urgency is implied, leave due as null.
- If an existing folder fits well, set existingFolderId and leave newFolderSuggestion null.
- If nothing fits (including when no folders exist yet), propose a new folder — top-level if this is a genuinely new life area, or nested under the closest existing parent otherwise. Leave existingFolderId null.
- actionItems can be an empty array if there are genuinely none.
- Output strictly valid JSON only.`;

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
        { role: 'user', content: `Transcript:\n"""\n${transcript}\n"""` },
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
    throw new Error('AI returned invalid JSON — try again.');
  }
}
