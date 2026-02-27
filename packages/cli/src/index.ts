#!/usr/bin/env node
import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { devicesCommand } from './commands/devices.js';
import { screenshotCommand } from './commands/screenshot.js';

const program = new Command();

program
  .name('monocle')
  .description('Playwright for mobile — AI agent testing for iOS apps')
  .version('0.1.0');

program
  .command('start')
  .description('Start the Monocle server (REST API + WebSocket streaming)')
  .option('-p, --port <port>', 'Server port', '7200')
  .option('--stdio', 'Run in stdio mode (MCP transport for Claude Code)')
  .action(startCommand);

program
  .command('devices')
  .description('List available iOS simulators')
  .action(devicesCommand);

program
  .command('screenshot')
  .description('Capture a screenshot from the booted simulator')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Image format (jpeg or png)', 'jpeg')
  .action(screenshotCommand);

program.parse();
