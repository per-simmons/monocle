# Monocle

**Playwright for Mobile** — Give AI agents the ability to test any iOS mobile app.

Monocle is an open-source MCP server + visual dashboard that lets AI agents (Claude Code, Cursor, etc.) interact with iOS simulators through 21+ tools: tap, swipe, type, screenshot, inspect elements, wait for conditions, record sessions, and more.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            Monocle Dashboard (Next.js)               │
│  Live Simulator View + Agent Chat + Action Timeline  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP + WebSocket (:7200)
┌───────────────────────▼─────────────────────────────┐
│            Monocle Server (Node.js)                  │
│  MCP Server (stdio+HTTP) + REST API + WS Streaming   │
│  21+ tools • Element refs (@e1) • Session recording  │
└───────────┬────────────────────────┬────────────────┘
            │                        │
     idb_companion              xcrun simctl
     (accessibility,            (screenshots,
      tap, swipe, type)          recording, lifecycle)
```

## Quick Start

```bash
# Prerequisites: Xcode 15+, Node.js 20+, idb_companion
npm install
npm run dev

# Or use via MCP (stdio mode for Claude Code):
npx tsx packages/server/src/index.ts --stdio
```

### MCP Configuration

```json
{
  "mcpServers": {
    "monocle": {
      "command": "npx",
      "args": ["tsx", "/path/to/monocle/packages/server/src/index.ts", "--stdio"]
    }
  }
}
```

## Tools (21+)

| Category | Tools |
|----------|-------|
| **Screen** | `screenshot`, `getScreenText` |
| **Interact** | `tap`, `tapByText`, `tapById`, `doubleTap`, `longPress`, `swipe`, `type`, `typeInto`, `pressKey` |
| **Inspect** | `listElements`, `findElement`, `getElementInfo` |
| **Wait** | `waitForElement`, `waitForText`, `assertVisible` |
| **Device** | `listDevices`, `launchApp`, `terminateApp`, `getDeviceInfo`, `openUrl` |
| **Record** | `startRecording`, `stopRecording` |

## Element Refs

Monocle assigns short refs (`@e1`, `@e2`, ...) to every UI element. Use them anywhere:

```
Agent: "tap @e3"  → taps the Login button
Agent: "type into @e5 'hello@example.com'"  → types into email field
```

Refs are stable within a session — same element keeps the same ref across calls.

## Packages

- **`packages/server`** — MCP server, iOS bridges, streaming, sessions
- **`packages/dashboard`** — Next.js visual dashboard
- **`packages/cli`** — CLI (`monocle start`, `monocle devices`, `monocle screenshot`)

## Prerequisites

- macOS with Xcode 15+
- At least one iOS Simulator booted
- `idb_companion` installed (`brew install idb-companion`)
- Python 3.11 venv with `fb-idb` (for accessibility tree)

## License

MIT — Pivot Studio AI
