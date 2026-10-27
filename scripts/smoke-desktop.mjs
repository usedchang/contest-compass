import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { _electron as electron } from 'playwright-core';

const packagedExe = process.env.COMPASS_DESKTOP_EXE;
const executablePath = resolve(packagedExe || 'node_modules/electron/dist/electron.exe');
const app = await electron.launch({
  executablePath,
  args: packagedExe ? [] : ['.'],
  env: { ...process.env, COMPASS_HEADLESS_TEST: '1' }
});
try {
  const window = await app.firstWindow();
  await window.locator('.page-title-row h1').waitFor({ timeout: 30000 });
  assert.equal(new URL(window.url()).protocol, 'compass:');
  assert.match(await window.title(), /Contest Compass/);
  await window.waitForFunction(() => document.querySelector('.problem-title'));
  console.log('Desktop smoke test passed: custom protocol, UI, and problem pool');
} finally {
  await app.close();
}
