#!/usr/bin/env python3
"""Click the "Emulator" button in a running Zepp OS Simulator via CDP.

Exit codes: 0 = clicked, 2 = could not automate (caller should click manually).
"""

import asyncio
import json
import os
import sys
import urllib.request

try:
    import websockets
except Exception:
    sys.exit(2)

CONFIG = os.path.expanduser("~/.config/simulator")


def devtools_port():
    p = os.path.join(CONFIG, "DevToolsActivePort")
    if os.path.exists(p):
        with open(p) as f:
            line = f.readline().strip()
            if line.isdigit():
                return int(line)
    return None


async def click(port):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as r:
        targets = json.load(r)
    page = next((t for t in targets if t.get("type") == "page"), None)
    if not page:
        return False
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=None) as ws:
        expr = ("(()=>{const s=[...document.querySelectorAll('span')]"
                ".find(e=>e.textContent.trim()==='Emulator');"
                "if(!s)return 'no-button'; s.click(); return 'clicked';})()")
        await ws.send(json.dumps({
            "id": 1, "method": "Runtime.evaluate",
            "params": {"expression": expr, "returnByValue": True},
        }))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("id") == 1:
                val = msg.get("result", {}).get("result", {}).get("value")
                return val == "clicked"
    return False


def main():
    port = devtools_port()
    if not port:
        os._exit(2)
    try:
        ok = asyncio.run(click(port))
    except Exception:
        os._exit(2)
    # os._exit: websockets/asyncio can keep the process alive; force exit.
    os._exit(0 if ok else 2)


if __name__ == "__main__":
    main()
