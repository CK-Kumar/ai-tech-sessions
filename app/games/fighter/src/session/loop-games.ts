// The two agents the loop scene can run: the same loop, with different tools.
// A simulation: every turn is written here, the page makes no API calls.

export interface Turn {
  call: string | null; // what the model wrote as a tool call; null = it wrote no tool call
  tool?: string; // the tool it called, to light in the tools list
  said?: string; // plain text it wrote instead of a tool call
  result: string; // what your code did, and sends back
}

export interface Game {
  id: string;
  label: string;
  memory: { title: string; who: string }; // the Context node in the circle
  toolsWho: string; // the Tools node in the circle
  code: { line: string; note: string }[];
  appendLine: number; // the line where the result comes back
  noneLine: number; // the line that runs when there is no tool call
  tools: { name: string; text: string }[];
  turns: Turn[];
}

// ---------- Hanoi: one tool, and the model keeps every turn in its memory ----------

type Board = Record<string, number[]>;
const boardText = (b: Board) => ['A', 'B', 'C'].map((p) => `${p}: [${b[p]!.join(', ')}]`).join('   ');

/** The perfect moves: the n-1 small disks out of the way, the big one across, the n-1 back on top of it. */
function solve(n: number, from = 'A', to = 'C', via = 'B'): [string, string][] {
  if (n === 0) return [];
  return [...solve(n - 1, from, via, to), [from, to], ...solve(n - 1, via, to, from)];
}

function hanoiTurns(): Turn[] {
  const board: Board = { A: [4, 3, 2, 1], B: [], C: [] };
  const moves: Turn[] = solve(4).map(([from, to]) => {
    board[to]!.push(board[from]!.pop()!);
    return { call: `move_disk(from_peg="${from}", to_peg="${to}")`, tool: 'move_disk', result: `Done: ${from}→${to}.  ${boardText(board)}` };
  });
  // The last turn: everything is on C, so the model writes an answer instead of a tool call, and the loop ends.
  return [...moves, { call: null, said: 'All four disks are on C. Solved.', result: 'No tool call, so the loop stops.' }];
}

const HANOI: Game = {
  id: 'hanoi',
  label: 'Hanoi',
  memory: { title: 'Context', who: 'the memory' },
  toolsWho: 'move_disk',
  code: [
    { line: 'context = [task]', note: 'the memory starts with the task' },
    { line: 'while True:', note: 'the loop' },
    { line: '    reply = model(context, tools=TOOLS)', note: 'the brain writes text' },
    { line: '    if reply.tool_call:', note: 'did it ask for a tool?' },
    { line: '        result = run_tool(reply.tool_call)', note: 'your code runs the tool' },
    { line: '        context += [reply, result]', note: 'appended to the memory' },
    { line: '    else: break', note: 'no tool call: it is done' },
  ],
  appendLine: 5,
  noneLine: 6,
  tools: [{ name: 'move_disk(from_peg, to_peg)', text: 'move the top disk. Pegs: "A", "B" or "C"' }],
  turns: hanoiTurns(),
};

// ---------- Fight: eleven tools, a 2-second deadline, and no memory (it sees only the fight right now) ----------

const FIGHT: Game = {
  id: 'fight',
  label: 'Fight',
  memory: { title: 'State', who: 'the fight now' },
  toolsWho: '11 moves',
  code: [
    { line: 'state = new_round()', note: 'the fight starts' },
    { line: 'while not knocked_out(state):', note: 'the loop' },
    { line: '    reply = model(state, tools=MOVES)', note: 'the brain writes text, in 2 s' },
    { line: '    if reply.tool_call:', note: 'did it pick a move in time?' },
    { line: '        state = run_move(reply.tool_call)', note: 'your code moves the fighter' },
    { line: '    else: state = block()', note: 'too late: your code blocks' },
  ],
  appendLine: 4,
  noneLine: 5,
  tools: [
    { name: 'straight()', text: 'quick punch' },
    { name: 'high_kick()', text: 'strong kick, slower' },
    { name: 'sweep()', text: 'low kick, knocks down' },
    { name: 'jump_kick()', text: 'kick from the air' },
    { name: 'block_high()', text: 'stop punches and kicks' },
    { name: 'block_low()', text: 'stop sweeps' },
    { name: 'walk_forward()', text: 'step in' },
    { name: 'dash_forward()', text: 'close in fast' },
    { name: 'walk_back()', text: 'step away' },
    { name: 'backdash()', text: 'jump out of range' },
    { name: 'jump()', text: 'jump up' },
  ],
  turns: [
    { call: 'dash_forward()', tool: 'dash_forward()', result: 'Dashed in. Distance 2.1 → 1.4' },
    { call: 'straight()', tool: 'straight()', result: 'Hit. Opponent 100 → 92 HP' },
    { call: 'block_high()', tool: 'block_high()', result: 'Blocked their high kick. No damage' },
    { call: null, said: '(still thinking after 2 s…)', result: 'Too late: your code blocked for it' },
    { call: 'sweep()', tool: 'sweep()', result: 'Hit. Opponent knocked down, 92 → 80 HP' },
    { call: 'jump_kick()', tool: 'jump_kick()', result: 'Missed. They stepped back' },
    { call: 'dash_forward()', tool: 'dash_forward()', result: 'Dashed in. Distance 2.0 → 1.3' },
    { call: 'high_kick()', tool: 'high_kick()', result: 'Hit. Opponent 80 → 66 HP' },
  ],
};

export const GAMES = [HANOI, FIGHT];
