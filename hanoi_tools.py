"""The three tools Claude can call in Hanoi, and what the harness does when it calls one.

One tool per destination tower. The model picks the tool (where to) and the disk (which one):

    move_to_C(disk=1)  →  disk 1 is on top of tower A  →  move A→C  →  legal? do it, else say why not
"""

from hanoi import TOWERS, apply, legal_moves
from players import board_text


def move_tool(tower, n):
    return {
        "name": f"move_to_{tower}",
        "description": f"Move one disk onto tower {tower}. Only a disk on top of its tower can move.",
        "input_schema": {
            "type": "object",
            "properties": {
                "disk": {"type": "integer", "enum": list(range(1, n + 1)), "description": "The disk to move. 1 is the smallest."},
            },
            "required": ["disk"],
            "additionalProperties": False,
        },
        # The API checks the arguments against the schema, so a call always names a real disk.
        "strict": True,
    }


def make_tools(n):
    return [move_tool(tower, n) for tower in TOWERS]


def run_tool(towers, n, name, args):
    """Returns (board, text for the model, ok, move). The model never touches the board: this function does, after
    checking every rule. When a move is illegal, the text says why, so the model can fix it on its next turn."""
    to = name.removeprefix("move_to_")
    disk = args.get("disk")
    if to not in TOWERS or disk not in range(1, n + 1):
        return towers, f"Unknown call {name}({args}). Use move_to_A, move_to_B or move_to_C with a disk from 1 to {n}.", False, name

    # Where is that disk now?
    frm = next(tower for tower in TOWERS if disk in towers[tower])
    move = f"{frm}→{to}"
    if frm == to:
        problem = f"disk {disk} is already on tower {to}"
    elif towers[frm][-1] != disk:
        problem = f"disk {disk} is under disk {towers[frm][-1]} on tower {frm}, and only the top disk can move"
    elif move not in legal_moves(towers):
        problem = f"disk {disk} is bigger than disk {towers[to][-1]}, which is on top of tower {to}"
    else:
        towers = apply(towers, move)
        return towers, f"Done: disk {disk} moved {move}.\n{board_text(towers, n)}", True, move
    return towers, f"Illegal: {problem}. Board unchanged.\n{board_text(towers, n)}", False, move
