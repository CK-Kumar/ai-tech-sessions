"""Turn real runs (runs/*.jsonl) into what the loop scene plays back: the last Hanoi game, and 3 fight turns.

Run after a good Hanoi game or fight:  uv run python export_loop.py
"""

import json
import os

from claude_agent import THINK_EACH_MOVE
from players import board_text

OUT = "app/games/fighter/public/session/loop.json"


def read(path):
    return [json.loads(line) for line in open(path)]


def hanoi():
    events = read("runs/hanoi.jsonl")
    last_start = max(i for i, e in enumerate(events) if e["type"] == "start")
    game = events[last_start:]
    start = game[0]
    # The first message of the context: exactly the task claude_agent.py sends.
    task = board_text(start["board"], start["disks"]) + "\nSolve it using the move_disk tool, one move per call.\n" + THINK_EACH_MOVE
    moves = [
        {"call": e["tool_call"], "said": e.get("said", ""), "result": e.get("result", ""), "context_tokens": e.get("context_tokens", 0), "board": e["board"]}
        for e in game
        if e["type"] == "move"
    ]
    return {"model": start["model"], "task": task, "board": start["board"], "moves": moves}


def fight():
    fast = [r for r in read("runs/fight.jsonl") if r["model"].endswith("decisions") and "move" in r["answers"]]
    slow = [r for r in read("runs/fight_luna_medium.jsonl") if r["ms"] > 2000]
    turns = []
    for r, late in [(fast[0], False), (fast[1], False), (slow[0], True)]:
        a = r["answers"]["move"]
        turns.append({
            "state": r["state"],
            "model": "GPT-6 Luna (thinking)" if late else "GPT-6 Luna Decisions",
            "choice": a["choice"],
            "ms": r["ms"],
            "late": late,
        })
    return turns


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = {"hanoi": hanoi(), "fight": fight()}
    json.dump(data, open(OUT, "w"), indent=2, ensure_ascii=False)
    print(f"wrote {OUT}: {len(data['hanoi']['moves'])} Hanoi moves, {len(data['fight'])} fight turns")
