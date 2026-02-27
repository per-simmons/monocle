import type Anthropic from '@anthropic-ai/sdk';

type Tool = Anthropic.Messages.Tool;

/**
 * All 24 Monocle tools in Anthropic SDK format.
 * These are sent to Claude so it can call them during the agent loop.
 */
export const monocleTools: Tool[] = [
  // === Screen ===
  {
    name: 'screenshot',
    description: 'Capture a screenshot of the current simulator screen. Returns a base64 JPEG/PNG image.',
    input_schema: {
      type: 'object' as const,
      properties: {
        format: { type: 'string', enum: ['jpeg', 'png'], description: 'Image format (default: jpeg)' },
        width: { type: 'number', description: 'Resize width in pixels (default: 1024)' },
      },
    },
  },
  {
    name: 'getScreenText',
    description: 'Get all visible text on the current screen. Returns newline-separated text from all visible elements.',
    input_schema: { type: 'object' as const, properties: {} },
  },

  // === Interaction ===
  {
    name: 'tap',
    description: 'Tap at coordinates or element ref. Use x/y for coordinates, or ref for element ref like "@e3".',
    input_schema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number', description: 'X coordinate (iOS logical points)' },
        y: { type: 'number', description: 'Y coordinate (iOS logical points)' },
        ref: { type: 'string', description: 'Element ref like "@e3"' },
      },
    },
  },
  {
    name: 'tapByText',
    description: 'Tap an element matching visible text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Text to find and tap' },
        exact: { type: 'boolean', description: 'Require exact match (default: false)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'tapById',
    description: 'Tap an element matching accessibility ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        accessibilityId: { type: 'string', description: 'Accessibility identifier to find' },
      },
      required: ['accessibilityId'],
    },
  },
  {
    name: 'doubleTap',
    description: 'Double tap at coordinates or element ref.',
    input_schema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        ref: { type: 'string' },
      },
    },
  },
  {
    name: 'longPress',
    description: 'Long press at coordinates or element ref.',
    input_schema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        ref: { type: 'string' },
        durationMs: { type: 'number', description: 'Duration in milliseconds (default: 1000)' },
      },
    },
  },
  {
    name: 'swipe',
    description: 'Swipe between two points or in a direction.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fromX: { type: 'number' },
        fromY: { type: 'number' },
        toX: { type: 'number' },
        toY: { type: 'number' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Swipe direction (alternative to from/to coords)' },
        durationMs: { type: 'number', description: 'Swipe duration (default: 300)' },
      },
    },
  },
  {
    name: 'type',
    description: 'Type text into the currently focused element.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['text'],
    },
  },
  {
    name: 'typeInto',
    description: 'Find an element by ref/text/ID, tap it, then type text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Element selector — @e3, "Search", or #search-field' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'pressKey',
    description: 'Press a hardware key.',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', enum: ['home', 'lock', 'siri', 'volumeUp', 'volumeDown'], description: 'Key to press' },
      },
      required: ['key'],
    },
  },

  // === Inspection ===
  {
    name: 'listElements',
    description: 'Get the accessibility tree with element refs (@e1, @e2, ...). Use refs in other commands. ALWAYS call this before trying to tap or interact with elements.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'findElement',
    description: 'Find a single element by text, accessibility ID, ref, or type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Element selector — @e3 (ref), "Login" (text), #login-btn (ID)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'getElementInfo',
    description: 'Get detailed info about an element by its ref.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ref: { type: 'string', description: 'Element ref like "@e3"' },
      },
      required: ['ref'],
    },
  },

  // === Wait ===
  {
    name: 'waitForElement',
    description: 'Wait until an element matching the selector appears on screen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Element selector — "Login", #login-btn, @e3' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default: 10000)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'waitForText',
    description: 'Wait until specific text appears anywhere on screen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Text to wait for' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default: 10000)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'assertVisible',
    description: 'Assert that an element is visible on screen. Returns error if not found.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Element selector' },
      },
      required: ['selector'],
    },
  },

  // === Device ===
  {
    name: 'listDevices',
    description: 'List all available iOS simulators.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'launchApp',
    description: 'Launch an app by bundle ID on the simulator.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bundleId: { type: 'string', description: 'App bundle ID (e.g., "live.vibin.app")' },
      },
      required: ['bundleId'],
    },
  },
  {
    name: 'terminateApp',
    description: 'Terminate a running app.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bundleId: { type: 'string', description: 'App bundle ID' },
      },
      required: ['bundleId'],
    },
  },
  {
    name: 'getDeviceInfo',
    description: 'Get info about the current simulator (name, OS, screen size).',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'openUrl',
    description: 'Open a URL or deep link in the simulator.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL or deep link to open' },
      },
      required: ['url'],
    },
  },

  // === Recording ===
  {
    name: 'startRecording',
    description: 'Start video recording of the simulator screen (H.264).',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Output filename (default: auto-generated)' },
      },
    },
  },
  {
    name: 'stopRecording',
    description: 'Stop the current video recording and return the file path.',
    input_schema: { type: 'object' as const, properties: {} },
  },
];
