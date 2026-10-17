"""The fighter's harness. Opper's game thinks it is calling Opper; it is calling this instead."""

import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests
from dotenv import load_dotenv
from urllib.parse import parse_qs, urlparse

from agent import play_steps as openai_steps
from claude_agent import play_steps as claude_steps

load_dotenv()

LOG = "runs/fight.jsonl"


def ask_jev(model, state, questions):
    r = requests.post(
        "https://api.typesafe.ai/v1/systemone",
        headers={"Authorization": f"Bearer {os.environ['TYPESAFE_API_KEY']}"},
        json={"model": model, "state": state, "questions": questions},
        timeout=5,
    )
    r.raise_for_status()
    data = r.json()
    return data["answers"], data.get("usage", {})


def ask_luna_text(state, questions, effort=os.environ.get("LUNA_EFFORT", "none")):
    # Same question Jev gets, but as a prompt: Luna has to *write* its answer, token by token.
    # The game asks "move"; its warm-up ping before a fight asks "warmup".
    name, q = next(iter(questions.items()))
    prompt = (
        q["instructions"]
        + "\n\nSituation:\n" + "\n".join(f"{k}: {v}" for k, v in state.items())
        + "\n\nMoves:\n" + "\n".join(f"{m}: {facts}" for m, facts in q["criteria"].items())
        + "\n\nReply with the move name only."
    )
    r = requests.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        # Thinking tokens count toward max_output_tokens, so leave room when thinking is on.
        json={"model": "gpt-6-luna", "input": prompt, "reasoning": {"effort": effort}, "max_output_tokens": 16 if effort == "none" else 4000},
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    text = next(c["text"] for item in data["output"] if item["type"] == "message" for c in item["content"])
    move = text.strip().strip("`.\"'").lower()
    # Sometimes it writes the description ("Option A") instead of the key ("a").
    by_description = {str(facts).lower(): m for m, facts in q["criteria"].items()}
    move = by_description.get(move, move)
    if move not in q["criteria"]:
        raise ValueError(f"Luna wrote {text!r}, not a move")
    return {name: {"type": "choice", "choice": move, "text": text}}, data.get("usage", {})


def ask_luna_decisions(state, questions):
    # Same question as Jev, translated to OpenAI's shape: list of choices in, list of answers out.
    name, q = next(iter(questions.items()))
    r = requests.post(
        "https://api.openai.com/v1/decisions",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={
            "model": "gpt-6-luna",
            "input": "\n".join(f"{k}: {v}" for k, v in state.items()),
            "questions": [{
                "type": "choice",
                "name": name,
                "instructions": q["instructions"],
                "choices": [{"value": m, "description": facts} for m, facts in q["criteria"].items()],
            }],
        },
        timeout=5,
    )
    r.raise_for_status()
    data = r.json()
    a = data["answers"][0]
    probs = {p["value"]: p["probability"] for p in a["probabilities"]}
    return {name: {"type": "choice", "choice": a["choice"], "probabilities": probs}}, data.get("usage", {})


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # /hanoi?agent=claude&disks=4&model=claude-sonnet-5-5&effort=medium streams the agent loop to the page, one move per message
        # (Server-Sent Events: the page keeps the connection open and gets each line as soon as it's written).
        url = urlparse(self.path)
        if url.path != "/hanoi":
            self.reply(404, {"error": "not found"})
            return
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")  # the page is served from another port
        self.end_headers()
        n, effort = int(q.get("disks", 4)), q.get("effort", "medium")
        if q.get("agent", "claude") == "claude":
            steps = claude_steps(n, effort, q.get("model", "claude-sonnet-5-5"))
        else:
            steps = openai_steps(n, effort, q.get("model", "gpt-6-sol"))
        try:
            for event in steps:
                with open("runs/hanoi.jsonl", "a") as f:
                    f.write(json.dumps(event) + "\n")
                self.wfile.write(f"data: {json.dumps(event)}\n\n".encode())
                self.wfile.flush()
                print(f"hanoi {event['type']:5} {event.get('move', '')} {event.get('ms', '')}")
        except (BrokenPipeError, ConnectionResetError):
            print("hanoi: the page left, loop stopped")

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        model = body.get("model", "")
        start = time.time()
        if model.startswith("typesafe/jev"):
            # "typesafe/jev-1.14.0" → "jev-1.14.0": the page picks the version.
            answers, usage = ask_jev(model.split("/")[1], body["state"], body["questions"])
        elif model.startswith("openai/gpt-6-luna"):
            ask = ask_luna_decisions if model.endswith("decisions") else ask_luna_text
            try:
                answers, usage = ask(body["state"], body["questions"])
            except Exception as e:
                print(f"{model:28} failed: {e}")
                self.reply(502, {"error": str(e)})
                return
        else:
            self.reply(400, {"error": f"server.py does not play {model} yet"})
            return
        ms = int((time.time() - start) * 1000)
        with open(LOG, "a") as f:
            f.write(json.dumps({"model": model, "ms": ms, "state": body["state"], "answers": answers}) + "\n")
        print(f"{model:28} {ms:5} ms  →  {next(iter(answers.values()))['choice']}")
        self.reply(200, {"answers": answers, "usage": usage})

    def reply(self, status, data):
        out = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *args):
        pass  # our own print line above is enough


if __name__ == "__main__":
    os.makedirs("runs", exist_ok=True)
    print("harness on http://localhost:8787")
    ThreadingHTTPServer(("localhost", 8787), Handler).serve_forever()
