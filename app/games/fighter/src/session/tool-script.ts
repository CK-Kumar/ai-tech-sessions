// The tool slide's script: how a model that only continues text ends up calling tools, in three steps.
// The text is what the model really sees, in Qwen's chat format, shortened (real tool lists are JSON). Claude and GPT
// do the same; their exact format is private.
// Each turn is a band (who wrote it, in colour). ⟦text|note⟧ marks a callout: a short note pointing at that text.

export interface Question {
  ask: string;
  tool: 'add' | 'subtract';
  a: number;
  b: number;
  result: number;
}

export const QUESTIONS: Question[] = [
  { ask: 'What is 12 + 30?', tool: 'add', a: 12, b: 30, result: 42 },
  { ask: 'What is 50 - 18?', tool: 'subtract', a: 50, b: 18, result: 32 },
];

export interface Line {
  text: string;
  by: 'given' | 'model'; // given: shown at once · model: typed in, token by token
}

export interface Band {
  kind: 'plain' | 'you' | 'model' | 'tools';
  label: string; // who wrote it, in plain words, on the right
  lines: Line[];
}

export interface Step {
  name: string;
  line: string; // the one sentence to say
  bands: Band[];
  asks?: boolean; // this step has the question switch
  after?: string; // a quiet line shown once the model has written its part
}

const given = (...texts: string[]): Line[] => texts.map((text) => ({ text, by: 'given' }));

export function steps(q: Question): Step[] {
  const tools: Band = {
    kind: 'tools',
    label: 'tools you wrote',
    lines: given('<|im_start|>system', '<tools>', 'add(a, b): Add two numbers', 'subtract(a, b): Subtract b from a', '</tools><|im_end|>'),
  };
  const you: Band = { kind: 'you', label: 'you', lines: given('<|im_start|>user', `${q.ask}<|im_end|>`) };
  const args = `"a": ${q.a}, "b": ${q.b}`;
  const call = `<tool_call>{"name": "⟦${q.tool}|picks a tool⟧", "arguments": {⟦${args}|fills in the numbers⟧}}</tool_call><|im_end|>`;
  return [
    {
      name: 'Base model',
      line: 'It only continues text.',
      bands: [
        {
          kind: 'plain',
          label: 'just text',
          lines: [
            { text: 'What is the capital of Spain?', by: 'given' },
            { text: 'What is the capital of France?', by: 'model' },
            { text: 'What is the capital of Italy?', by: 'model' },
            { text: '⟦What is the capital of|it continues, it does not answer⟧', by: 'model' },
          ],
        },
      ],
    },
    {
      name: 'Chat template (SFT)',
      line: 'Trained on chats in a template.',
      bands: [
        { kind: 'you', label: 'you', lines: given('<|im_start|>user', 'What is the capital of Spain?<|im_end|>') },
        {
          kind: 'model',
          label: 'model',
          lines: [
            { text: '⟦<|im_start|>assistant|your code opens its turn⟧', by: 'given' },
            { text: 'Madrid.⟦<|im_end|>|it learned to end its turn⟧', by: 'model' },
          ],
        },
      ],
    },
    {
      name: 'Tool call',
      line: 'It picks a tool. As text.',
      bands: [tools, you, { kind: 'model', label: 'model', lines: [{ text: '<|im_start|>assistant', by: 'given' }, { text: call, by: 'model' }] }],
      asks: true,
      after: `Next: your code runs ${q.tool}(${q.a}, ${q.b}) → ${q.result}, and adds it to the context.`,
    },
  ];
}

// Roughly how a tokenizer cuts: a callout whole, special tokens and tags whole, then words, spaces and punctuation.
export const TOKENS = /⟦[^⟧]*⟧|<\|im_(?:start|end)\|>|<\/?(?:tools|tool_call|tool_response)>|\s+|\w+|[^\w\s]/g;
/** The special tokens and tags, drawn dimmer so the words stand out and the template is still there to read. */
export const MARKS = /(<\|im_(?:start|end)\|>|<\/?(?:tools|tool_call|tool_response)>)/;
