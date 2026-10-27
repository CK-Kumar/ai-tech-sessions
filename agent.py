"""The agent loop: GPT-6 Luna plays Hanoi by calling a move_disk tool until solved."""

import json
import os
import sys
import time

import requests
from dotenv import load_dotenv

from hanoi import apply, legal_moves, new_game, solved
from players import board_text

load_dotenv()

TOOLS = [
    {
        "type": "function",
        "name": "move_disk",
        "description": "Move the top disk from one tower to another.",
        "parameters": {
            "type": "object",
            "properties": {
                "from_tower": {"type": "string", "enum": ["A", "B", "C"]},
                "to_tower": {"type": "string", "enum": ["A", "B", "C"]},
            },
            "required": ["from_tower", "to_tower"],
            "additionalProperties": False,
        },
        "strict": True,
    }
]


def call_model(context, effort, model):
    r = requests.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={
            "model": model,
            "input": context,
            "tools": TOOLS,
            # "summary": ask for a readable summary of the thinking, to show on screen.
            "reasoning": {"effort": effort, **({"summary": "auto"} if effort != "none" else {})},
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def run_tool(towers, n, args):
    move = f"{args['from_tower']}→{args['to_tower']}"
    # The model can ask for anything, so the harness checks the rules, not the model.
    if move not in legal_moves(towers):
        return towers, f"Illegal move {move}. Board unchanged:\n{board_text(towers, n)}", False
    towers = apply(towers, move)
    return towers, f"Done: {move}.\n{board_text(towers, n)}", True


def thinking_of(output):
    """The thinking summary in a response (OpenAI shows a summary, never the raw thinking tokens)."""
    return " ".join(part["text"] for item in output if item["type"] == "reasoning" for part in item.get("summary", []))


def play_steps(n, effort="medium", model="gpt-6-luna"):
    """The agent loop, one event at a time, so a page can draw each move as it happens."""
    towers = new_game(n)
    # The context is the whole conversation; it grows every turn and is sent in full each call.
    context = [{"role": "user", "content": board_text(towers, n) + "\nSolve it using the move_disk tool, one move per call."}]
    moves = illegal = calls = 0
    start = time.time()
    yield {"type": "start", "board": towers, "disks": n, "optimal": 2**n - 1, "model": model, "effort": effort}
    while not solved(towers, n) and moves + illegal < 3 * (2**n - 1):
        asked = time.time()
        response = call_model(context, effort, model)
        ms = int((time.time() - asked) * 1000)
        calls += 1
        # Reasoning items must go back with the tool results, so keep every output item.
        context += response["output"]
        thinking = thinking_of(response["output"])
        # Always reported, even when the thinking text itself is hidden.
        thought = response.get("usage", {}).get("output_tokens_details", {}).get("reasoning_tokens", 0)
        tool_calls = [item for item in response["output"] if item["type"] == "function_call"]
        if not tool_calls:
            context.append({"role": "user", "content": "Not solved yet. Call move_disk."})
            yield {"type": "nudge", "thinking": thinking, "thought": thought, "ms": ms}
            continue
        for item in tool_calls:
            args = json.loads(item["arguments"])
            towers, result, ok = run_tool(towers, n, args)
            moves += ok
            illegal += not ok
            context.append({"type": "function_call_output", "call_id": item["call_id"], "output": result})
            yield {
                "type": "move",
                "move": f"{args['from_tower']}→{args['to_tower']}",
                "ok": ok,
                "board": towers,
                "moves": moves,
                "illegal": illegal,
                "thinking": thinking,
                "thought": thought,
                "ms": ms,
                "tool_call": {"name": item["name"], "arguments": args},
            }
            thinking, thought = "", 0  # one response's thinking belongs to its first move only
    yield {"type": "done", "solved": solved(towers, n), "moves": moves, "illegal": illegal, "calls": calls, "seconds": round(time.time() - start, 1)}


def play(n, effort="medium", model="gpt-6-luna"):
    for event in play_steps(n, effort, model):
        pass
    return {"disks": n, "effort": effort, "optimal": 2**n - 1, **event}


if __name__ == "__main__":
    model = sys.argv[1] if len(sys.argv) > 1 else "gpt-6-luna"
    effort = sys.argv[2] if len(sys.argv) > 2 else "medium"
    sizes = [int(x) for x in sys.argv[3:]] or [3, 4]
    print("disks  effort  solved  moves  optimal  illegal  calls  seconds")
    for n in sizes:
        r = play(n, effort, model)
        print(f"{r['disks']:5}  {r['effort']:6}  {str(r['solved']):6}  {r['moves']:5}  {r['optimal']:7}  {r['illegal']:7}  {r['calls']:5}  {r['seconds']:7}")
