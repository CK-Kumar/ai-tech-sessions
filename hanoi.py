"""Tower of Hanoi rules. No AI here: just the board and what moves are legal."""

PEGS = ["A", "B", "C"]


def new_game(n):
    # Biggest disk at the bottom, so the last item in each list is the top disk.
    return {"A": list(range(n, 0, -1)), "B": [], "C": []}


def legal_moves(pegs):
    moves = []
    for src in PEGS:
        for dst in PEGS:
            if src == dst or not pegs[src]:
                continue
            top = pegs[src][-1]
            if not pegs[dst] or pegs[dst][-1] > top:
                moves.append(f"{src}→{dst}")
    return moves


def apply(pegs, move):
    src, dst = move.split("→")
    # Copy so the old board is untouched; the log keeps every board.
    new = {p: list(disks) for p, disks in pegs.items()}
    new[dst].append(new[src].pop())
    return new


def solved(pegs, n):
    return len(pegs["C"]) == n


if __name__ == "__main__":
    pegs = new_game(3)
    print(pegs, legal_moves(pegs))
    for move in ["A→C", "A→B", "C→B"]:
        pegs = apply(pegs, move)
        print(move, "→", pegs, legal_moves(pegs))
    print("solved:", solved(pegs, 3))
