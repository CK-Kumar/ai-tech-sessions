"""Tower of Hanoi rules. No AI here: just the board and what moves are legal."""

TOWERS = ["A", "B", "C"]


def new_game(n):
    # Biggest disk at the bottom, so the last item in each list is the top disk.
    return {"A": list(range(n, 0, -1)), "B": [], "C": []}


def legal_moves(towers):
    moves = []
    for src in TOWERS:
        for dst in TOWERS:
            if src == dst or not towers[src]:
                continue
            top = towers[src][-1]
            if not towers[dst] or towers[dst][-1] > top:
                moves.append(f"{src}→{dst}")
    return moves


def apply(towers, move):
    src, dst = move.split("→")
    # Copy so the old board is untouched; the log keeps every board.
    new = {p: list(disks) for p, disks in towers.items()}
    new[dst].append(new[src].pop())
    return new


def solved(towers, n):
    return len(towers["C"]) == n


if __name__ == "__main__":
    towers = new_game(3)
    print(towers, legal_moves(towers))
    for move in ["A→C", "A→B", "C→B"]:
        towers = apply(towers, move)
        print(move, "→", towers, legal_moves(towers))
    print("solved:", solved(towers, 3))
