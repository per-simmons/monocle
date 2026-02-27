import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from '../server.js';
import { registerScreenTools } from './screen.js';
import { registerInteractionTools } from './interact.js';
import { registerInspectionTools } from './inspect.js';
import { registerWaitTools } from './wait.js';
import { registerDeviceTools } from './device.js';
import { registerRecordingTools } from './record.js';

/**
 * Register all 21+ Monocle MCP tools.
 */
export function registerAllTools(server: McpServer, ctx: ToolContext) {
  registerScreenTools(server, ctx);       // screenshot, getScreenText
  registerInteractionTools(server, ctx);  // tap, tapByText, tapById, doubleTap, longPress, swipe, type, typeInto, pressKey
  registerInspectionTools(server, ctx);   // listElements, findElement, getElementInfo
  registerWaitTools(server, ctx);         // waitForElement, waitForText, assertVisible
  registerDeviceTools(server, ctx);       // listDevices, launchApp, terminateApp, getDeviceInfo, openUrl
  registerRecordingTools(server, ctx);    // startRecording, stopRecording
}
