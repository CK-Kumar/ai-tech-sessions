"""Players: each function takes a Hanoi board and returns (move, probabilities, ms)."""

import os
import time

import requests
from dotenv import load_dotenv

from hanoi import legal_moves, new_game

load_dotenv()

RULES = (
    "Tower of Hanoi. Move every disk to tower C. "
    "Move one disk at a time, only the top disk of a tower, "
    "and never put a bigger disk on a smaller one. "
    "Disks are numbers (bigger number = bigger disk); each tower is listed bottom to top."
)


def board_text(towers, n):
    lines = [f"{p}: {towers[p]}" for p in ["A", "B", "C"]]
    return f"{RULES}\n{n} disks.\n" + "\n".join(lines)


def describe(towers, move):
    src, dst = move.split("→")
    return f"Move disk {towers[src][-1]} from {src} to {dst}"


def ask_jev(towers, n):
    moves = legal_moves(towers)
    body = {
        "model": "jev-latest",
        "state": board_text(towers, n),
        "questions": {
            "move": {
                "type": "choice",
                "instructions": "Which move gets all disks to tower C in the fewest moves?",
                "criteria": {m: describe(towers, m) for m in moves},
            }
        },
    }
    start = time.time()
    r = requests.post(
        "https://api.typesafe.ai/v1/systemone",
        headers={"Authorization": f"Bearer {os.environ['TYPESAFE_API_KEY']}"},
        json=body,
        timeout=30,
    )
    ms = int((time.time() - start) * 1000)
    r.raise_for_status()
    answer = r.json()["answers"]["move"]
    return answer["choice"], answer["probabilities"], ms


def ask_luna_decisions(towers, n):
    moves = legal_moves(towers)
    body = {
        "model": "gpt-6-luna",
        "input": board_text(towers, n),
        "questions": [
            {
                "type": "choice",
                "name": "move",
                "instructions": "Which move gets all disks to tower C in the fewest moves?",
                "choices": [{"value": m, "description": describe(towers, m)} for m in moves],
            }
        ],
    }
    start = time.time()
    r = requests.post(
        "https://api.openai.com/v1/decisions",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json=body,
        timeout=30,
    )
    ms = int((time.time() - start) * 1000)
    r.raise_for_status()
    answer = r.json()["answers"][0]
    # OpenAI gives a list, Typesafe a map: make them the same shape.
    probs = {p["value"]: p["probability"] for p in answer["probabilities"]}
    return answer["choice"], probs, ms


if __name__ == "__main__":
    towers = new_game(3)
    print(board_text(towers, 3), "\n")
    for name, ask in [("jev", ask_jev), ("luna-decisions", ask_luna_decisions)]:
        move, probs, ms = ask(towers, 3)
        print(f"{name:15} → {move}   {ms} ms   {probs}")
