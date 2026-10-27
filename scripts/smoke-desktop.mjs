import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
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
  const raw = await window.evaluate(() => window.contestNative.fetchStatement('CF4A'));
  assert.match(raw, /lentille-context/);
  const catalog = await window.evaluate(() => window.contestNative.fetchAtcoderCatalog());
  assert.ok(catalog.problems.length > 9000);
  await window.evaluate(() => {
    localStorage.setItem('compass-history', JSON.stringify([{ id: '4A', source: 'codeforces', title: 'Watermelon', rating: 800, tags: ['math'], url: 'https://codeforces.com/problemset/problem/4/A' }]));
    localStorage.setItem('compass-favorites', JSON.stringify(['4A']));
  });
  await window.reload();
  await window.getByRole('button', { name: '我的题单' }).click();
  await window.locator('.library-item').filter({ hasText: 'Watermelon' }).locator('.open-item').click();
  await window.locator('.auto-status.success').waitFor({ timeout: 20000 });
  assert.match(await window.locator('.statement-body').innerText(), /西瓜/);
  await window.getByRole('button', { name: '原文' }).click();
  assert.match(await window.locator('.statement-body').innerText(), /watermelon/i);
  await window.getByRole('button', { name: '中文' }).click();
  assert.match(await window.locator('.statement-body').innerText(), /西瓜/);
  await window.getByRole('button', { name: /PNG 图片/ }).click();
  await window.locator('.toast').waitFor({ timeout: 15000 });
  assert.match(await window.locator('.toast').innerText(), /题面已导出/);
  assert.equal(readFileSync(join(tmpdir(), '4A-Watermelon.png')).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  console.log('Desktop smoke test passed: native statement fetch, Chinese/original views, and PNG export');
} finally {
  await app.close();
}
