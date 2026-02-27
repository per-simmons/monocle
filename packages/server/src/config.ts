export const config = {
  /** Server port for REST API + WebSocket */
  port: parseInt(process.env.MONOCLE_PORT ?? '7200', 10),

  /** Dashboard port */
  dashboardPort: parseInt(process.env.MONOCLE_DASHBOARD_PORT ?? '7201', 10),

  /** Target FPS for live simulator streaming */
  streamFps: parseInt(process.env.MONOCLE_FPS ?? '10', 10),

  /** Idle FPS (when screen hasn't changed) */
  streamIdleFps: 5,

  /** Active FPS (when screen is changing) */
  streamActiveFps: 15,

  /** JPEG quality for screenshots (0-100) */
  jpegQuality: parseInt(process.env.MONOCLE_JPEG_QUALITY ?? '70', 10),

  /** Default screenshot width for LLM consumption */
  screenshotWidth: parseInt(process.env.MONOCLE_SCREENSHOT_WIDTH ?? '1024', 10),

  /** Default timeout for waitFor operations (ms) */
  waitTimeout: parseInt(process.env.MONOCLE_WAIT_TIMEOUT ?? '5000', 10),

  /** Retry-if-no-change wait time (ms) */
  retryWaitMs: 2000,

  /** Session storage directory */
  sessionsDir: process.env.MONOCLE_SESSIONS_DIR ?? `${process.env.HOME}/.monocle/sessions`,

  /** WebSocket backpressure limit (bytes) */
  wsBackpressureLimit: 1024 * 1024, // 1MB
};
