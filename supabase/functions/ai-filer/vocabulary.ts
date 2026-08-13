/**
 * Everything the filer can file, and how it must describe it.
 *
 * This is the file sent on every call. It is deliberately the *actions* and not
 * the 724 names: names are resolved here, against the database, using the same
 * matcher that did the migration. That is both cheaper and better --
 *
 *   - 724 names is roughly 6,000 tokens on every request, for a list that
 *     changes whenever someone is added
 *   - a model picking from a list still cannot tell the two Avi Greens apart;
 *     the database can, and can ask which one
 *   - the migration's matcher already knows that Yaakov is Jacob and that
 *     "Jason Heideman" is "Jason Heidman", which a fresh model does not
 *
 * So the model's job is to hear *what happened to whom*, in words. Deciding
 * which record that is stays here.
 */

export type ActionId =
  | 'visit_came'
  | 'visit_stayed'
  | 'visit_expected'
  | 'event_attending'
  | 'engagement'
  | 'wedding_scheduled'
  | 'wedding'
  | 'birth'
  | 'bar_mitzvah'
  | 'update_field';

export type ActionSpec = {
  id: ActionId;
  says: string;
  needs: string[];
  optional?: string[];
};

export const ACTIONS: ActionSpec[] = [
  {
    id: 'visit_came',
    says: 'Someone visited the yeshiva and did not sleep there.',
    needs: ['person'],
    optional: ['date', 'note'],
  },
  {
    id: 'visit_stayed',
    says: 'Someone stayed overnight in the yeshiva. Use this whenever sleeping, '
      + 'staying over, or a number of nights is mentioned.',
    needs: ['person'],
    optional: ['date', 'nights', 'note'],
  },
  {
    id: 'visit_expected',
    says: 'Someone is coming to the yeshiva -- it has not happened yet.',
    needs: ['person'],
    optional: ['date', 'overnight', 'note'],
  },
  {
    id: 'event_attending',
    says: 'Someone is coming to a named event, such as the alumni shabbaton or a dinner.',
    needs: ['person'],
    optional: ['event', 'date', 'guests'],
  },
  {
    id: 'engagement',
    says: 'Someone got engaged. The wedding date is NOT known at engagement; if a '
      + 'date is mentioned, file wedding_scheduled as well.',
    needs: ['person'],
    optional: ['date', 'spouse'],
  },
  {
    id: 'wedding_scheduled',
    says: 'A wedding date has been set for someone already engaged. The date is required.',
    needs: ['person', 'date'],
  },
  {
    id: 'wedding',
    says: 'Someone got married, or is getting married on a given date.',
    needs: ['person'],
    optional: ['date', 'spouse'],
  },
  { id: 'birth', says: 'Someone had a baby.', needs: ['person'], optional: ['date'] },
  {
    id: 'bar_mitzvah',
    says: "Someone made a bar mitzvah for his son.",
    needs: ['person'],
    optional: ['date'],
  },
  {
    id: 'update_field',
    says: 'New or corrected information about someone: phone, email, address, city, '
      + 'college, occupation, wife\'s name. One action per field.',
    needs: ['person', 'field', 'value'],
  },
];

/** Only these may be set by `update_field`. */
export const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'nickname', 'email', 'phone',
  'street_address', 'city', 'state', 'zip_code', 'country',
  'high_school', 'college', 'grad_school', 'occupation',
  'marital_status', 'spouse_name', 'notes',
] as const;

export const SYSTEM_PROMPT = `
You turn spoken notes from a yeshiva's alumni director into filing actions.

Return one or more actions. Each names a person exactly as the speaker said it --
do not correct spelling, expand nicknames, or guess a fuller name. The database
resolves names itself and is better at it than you are.

Rules:
- One action per fact. "Avi came and gave me his new number" is two actions.
- A date is only ever what the speaker said. Never invent one. Put it verbatim
  in date_text, and resolve it to YYYY-MM-DD in date_iso -- "last Shabbos" and
  "next Tuesday" are calculations from today, not guesses. If no date was said,
  leave both empty; today's date is the sensible default and is applied later.
- Staying overnight is visit_stayed, not visit_came.
- An engagement never carries a wedding date. If a date is mentioned alongside
  one, file wedding_scheduled too.
- If you are not confident what is being filed, say so in \`unclear\` instead of
  guessing. Being asked again is cheap; a wrong record is not.

Available actions:
${ACTIONS.map((a) => `- ${a.id}: ${a.says} (needs: ${a.needs.join(', ')}${
  a.optional ? `; optional: ${a.optional.join(', ')}` : ''
})`).join('\n')}

Fields for update_field: ${EDITABLE_FIELDS.join(', ')}
`.trim();

/** The tool schema the model is constrained to. */
export const FILE_TOOL = {
  type: 'function',
  function: {
    name: 'file_actions',
    description: 'File one or more things said in the note.',
    parameters: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ACTIONS.map((a) => a.id) },
              person_said: {
                type: 'string',
                description: 'The name exactly as spoken, uncorrected.',
              },
              date_text: {
                type: 'string',
                description: 'The date as spoken, or empty. Never invented.',
              },
              date_iso: {
                type: 'string',
                description:
                  'date_text resolved to YYYY-MM-DD against the current date. ' +
                  'Empty if the speaker gave no date at all. This is a ' +
                  'calculation, not a guess: no date said means leave it empty.',
              },
              event: { type: 'string' },
              field: { type: 'string', enum: [...EDITABLE_FIELDS] },
              value: { type: 'string' },
              spouse: { type: 'string' },
              nights: { type: 'integer' },
              guests: { type: 'integer' },
              note: { type: 'string' },
            },
            required: ['action', 'person_said'],
            additionalProperties: false,
          },
        },
        unclear: {
          type: 'string',
          description: 'What could not be understood, if anything.',
        },
      },
      required: ['actions'],
      additionalProperties: false,
    },
  },
} as const;
