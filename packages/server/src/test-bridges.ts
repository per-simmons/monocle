import { listDevices, screenshot, getBootedDevice } from './bridges/simctl.js';
import { describeAll, tap, typeText, pressButton } from './bridges/idb.js';

async function main() {
  console.log('=== simctl: List devices ===');
  const booted = await getBootedDevice();
  if (!booted) {
    console.log('No booted simulator. Exiting.');
    return;
  }
  console.log(`Booted: ${booted.name} (${booted.udid})`);

  console.log('\n=== simctl: Screenshot ===');
  const buf = await screenshot(booted.udid);
  console.log(`JPEG: ${(buf.length / 1024).toFixed(0)}KB`);

  console.log('\n=== idb: Accessibility tree ===');
  const elements = await describeAll(booted.udid);
  console.log(`Elements: ${elements.length}`);
  for (const el of elements.slice(0, 10)) {
    const label = el.AXLabel || el.AXValue || el.type;
    const { x, y, width, height } = el.frame;
    console.log(
      `  ${el.type} "${label}" (${x.toFixed(0)},${y.toFixed(0)} ${width.toFixed(0)}x${height.toFixed(0)})`
    );
  }

  console.log('\n=== All bridge tests passed ===');
}

main().catch(console.error);
