"""The same Hanoi agent loop as agent.py, with Claude and three tools (hanoi_tools.py): it shows a readable summary of
its thinking every turn."""

import sys
import time

import anthropic
from dotenv import load_dotenv

from hanoi import new_game, solved
from hanoi_tools import make_tools, run_tool
from players import board_text

load_dotenv()
client = anthropic.Anthropic()

def call_model(messages, model, effort, tools):
    return client.messages.create(
        model=model,
        max_tokens=16000,
        tools=tools,
        # One tool call per response. Without it, Claude sends all 15 moves in one go and never thinks between them.
        tool_choice={"type": "auto", "disable_parallel_tool_use": True},
        # "summarized": without it the thinking blocks come back empty. Claude never shows the raw thinking.
        thinking={"type": "adaptive", "display": "summarized"},
        output_config={"effort": effort},
        messages=messages,
    )


# A harness choice: without this line, Claude plans once at move 1 and then just executes.
THINK_EACH_MOVE = "Before each tool call, write one short sentence saying why this move is right."


def play_steps(n, effort="medium", model="claude-sonnet-5-5", think_each_move=True):
    towers = new_game(n)
    tools = make_tools(n)
    task = board_text(towers, n) + "\nSolve it with the move tools, one move per call."
    if think_each_move:
        task += "\n" + THINK_EACH_MOVE
    messages = [{"role": "user", "content": task}]
    moves = illegal = calls = 0
    start = time.time()
    yield {"type": "start", "board": towers, "disks": n, "optimal": 2**n - 1, "model": model, "effort": effort}
    while not solved(towers, n) and moves + illegal < 3 * (2**n - 1):
        asked = time.time()
        response = call_model(messages, model, effort, tools)
        ms = int((time.time() - asked) * 1000)
        calls += 1
        if response.stop_reason == "refusal":
            yield {"type": "done", "solved": False, "moves": moves, "illegal": illegal, "calls": calls, "seconds": round(time.time() - start, 1), "error": "refusal"}
            return
        # The whole response goes back, thinking blocks included: the API needs them to continue the reasoning.
        messages.append({"role": "assistant", "content": response.content})
        thinking = " ".join(b.thinking for b in response.content if b.type == "thinking" and b.thinking)
        # Visible text it writes before the tool call (not hidden thinking: it chose to say this).
        said = " ".join(b.text for b in response.content if b.type == "text")
        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            messages.append({"role": "user", "content": "Not solved yet. Call move_disk."})
            yield {"type": "nudge", "thinking": thinking, "ms": ms}
            continue
        results = []
        for block in tool_uses:
            towers, result, ok, move = run_tool(towers, n, block.name, block.input)
            moves += ok
            illegal += not ok
            # is_error tells the model this call failed, so it reads the reason instead of assuming it worked.
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": result, "is_error": not ok})
            yield {
                "type": "move",
                "move": move,
                "ok": ok,
                "board": towers,
                "moves": moves,
                "illegal": illegal,
                "thinking": thinking,
                "said": said,
                "tokens": response.usage.output_tokens,
                # How much the model had to read this turn: the whole context, which grows every loop.
                "context_tokens": response.usage.input_tokens,
                "ms": ms,
                "tool_call": {"name": block.name, "arguments": block.input},
                "result": result,
            }
            thinking, said = "", ""
        # All results of one turn go back together, in one user message.
        messages.append({"role": "user", "content": results})
    yield {"type": "done", "solved": solved(towers, n), "moves": moves, "illegal": illegal, "calls": calls, "seconds": round(time.time() - start, 1)}


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    effort = sys.argv[2] if len(sys.argv) > 2 else "medium"
    model = sys.argv[3] if len(sys.argv) > 3 else "claude-sonnet-5-5"
    each = (sys.argv[4] if len(sys.argv) > 4 else "each") == "each"
    for e in play_steps(n, effort, model, each):
        if e["type"] == "move":
            print(f"{e['moves']:2} {e['move']} {e['ms']:5} ms  {e['tokens']:4} tok  | said: {e['said'][:80]} | thought: {e['thinking'][:50]}")
        elif e["type"] != "start":
            print(e)
