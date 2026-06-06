#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Pretty-print the FULL data flow of one OpenClaw agent turn, block by block:
#   USER INPUT -> BRAIN (tool call) -> civic-geo TOOL RESULT -> ... -> FINAL ANSWER
#
# Usage:  python3 trace.py /path/to/agent_output.json
# The agent JSON (from `openclaw agent --json`) points at the session .jsonl,
# which records each step as a `message` event with role
# user | assistant | toolResult and content blocks of type text | toolCall.
# ---------------------------------------------------------------------------
import json, sys, textwrap

BAR = "=" * 78
SUB = "-" * 78

def wrap(s, indent="    ", width=104):
    out = []
    for line in str(s).splitlines() or [""]:
        out.append(textwrap.fill(line, width, initial_indent=indent,
                                 subsequent_indent=indent) or indent)
    return "\n".join(out)

def short(obj, n=700):
    s = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + " …(truncated)"

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content
                        if isinstance(b, dict) and b.get("type") == "text")
    return ""

def toolcalls_of(content):
    if isinstance(content, list):
        return [b for b in content if isinstance(b, dict) and b.get("type") == "toolCall"]
    return []

def main(path):
    d = json.load(open(path))
    meta = d["meta"]["agentMeta"]
    sf = meta["sessionFile"]

    msgs = []
    for line in open(sf):
        line = line.strip()
        if not line:
            continue
        ev = json.loads(line)
        if ev.get("type") == "message" and isinstance(ev.get("message"), dict):
            msgs.append(ev["message"])

    print(BAR)
    print(f"  PIPELINE TRACE   model={meta.get('model')}  provider={meta.get('provider')}")
    print(f"                   took={d['meta'].get('durationMs')} ms   "
          f"tokens in/out={meta['usage'].get('input')}/{meta['usage'].get('output')}")
    print(BAR)

    step = 0
    def block(title, body):
        nonlocal step
        step += 1
        print(f"\n  STEP {step}.  {title}")
        print(SUB)
        print(body)

    for m in msgs:
        role = m.get("role")
        content = m.get("content")

        if role == "user":
            t = text_of(content).strip()
            if t:
                block("USER  →  question sent to the BRAIN", wrap(t))

        elif role == "assistant":
            tcs = toolcalls_of(content)
            for tc in tcs:
                name = tc.get("name") or tc.get("toolName")
                args = tc.get("arguments") or tc.get("input") or tc.get("args")
                if isinstance(args, str):
                    try: args = json.loads(args)
                    except Exception: pass
                block(f"BRAIN  →  decides to call tool  `{name}`   (INPUT to civic-geo)",
                      wrap(short(args)))
            if not tcs:
                t = text_of(content).strip()
                if t:
                    block("BRAIN  →  FINAL ANSWER   (what the user reads / hears)", wrap(t))

        elif role == "toolResult":
            res = text_of(content)
            try: res = json.loads(res)
            except Exception: pass
            block("civic-geo  →  RESULT   (OUTPUT returned to the BRAIN)",
                  wrap(short(res, 800)))

    print("\n" + BAR)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/agent.json")
