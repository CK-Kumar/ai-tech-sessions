"""The loop: ask a player for a move, apply it, repeat until solved or out of moves."""

import sys

from hanoi import apply, new_game, solved
from players import ask_jev


def board_key(towers):
    return tuple(tuple(towers[p]) for p in ["A", "B", "C"])


def play(n, ask, max_factor=3):
    optimal = 2**n - 1
    towers = new_game(n)
    seen = {board_key(towers)}
    repeats = 0
    total_ms = 0
    moves = 0
    while not solved(towers, n) and moves < optimal * max_factor:
        move, probs, ms = ask(towers, n)
        towers = apply(towers, move)
        moves += 1
        total_ms += ms
        # A board seen before means the player went in a circle.
        if board_key(towers) in seen:
            repeats += 1
        seen.add(board_key(towers))
    return {
        "disks": n,
        "solved": solved(towers, n),
        "moves": moves,
        "optimal": optimal,
        "repeats": repeats,
        "avg_ms": total_ms // moves,
    }


if __name__ == "__main__":
    sizes = [int(x) for x in sys.argv[1:]] or [3, 4, 5, 6]
    print("disks  solved  moves  optimal  repeats  avg_ms")
    for n in sizes:
        r = play(n, ask_jev)
        print(f"{r['disks']:5}  {str(r['solved']):6}  {r['moves']:5}  {r['optimal']:7}  {r['repeats']:7}  {r['avg_ms']:6}")
