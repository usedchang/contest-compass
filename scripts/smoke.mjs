import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const browserPath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!existsSync(browserPath)) throw new Error('Set CHROME_PATH to an installed Chrome executable');
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.locator('.problem-title').waitFor({ timeout: 30000 });
  assert.match(await page.locator('.problem-intro').textContent(), /来自 (Codeforces|AtCoder)/);
  const before = await page.locator('.problem-title').textContent();
  await page.getByRole('button', { name: /换一题/ }).click();
  const after = await page.locator('.problem-title').textContent();
  assert.notEqual(before, after);
  await page.getByRole('button', { name: '加入题单' }).click();
  await page.getByRole('button', { name: '题面导出', exact: true }).click();
  await page.getByRole('textbox', { name: '题面正文' }).fill('输入一个整数 n。\n输出 n 的平方。');
  const [markdown] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Markdown/ }).click()
  ]);
  const contents = readFileSync(await markdown.path(), 'utf8');
  assert.match(contents, /输入一个整数 n/);
  assert.match(contents, /输出 n 的平方/);
  await page.getByRole('button', { name: '我的题单' }).click();
  assert.equal(await page.locator('.library-item').count(), 1);

  await page.getByRole('button', { name: '随机练题' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  const dimensions = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.inner + 1, `mobile overflow: ${JSON.stringify(dimensions)}`);

  await page.getByRole('button', { name: 'AtCoder' }).click();
  await page.waitForFunction(() => Number(document.querySelector('.pool-summary strong')?.textContent.replaceAll(',', '')) > 0, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.problem-topline .source')?.textContent === 'ATCODER');
  await page.getByRole('button', { name: '查看题面' }).click();
  const editor = page.getByRole('textbox', { name: '题面正文' });
  await editor.fill('输入一个整数 n。\n输出 n 的平方。');
  const [html] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /HTML 网页/ }).click()
  ]);
  assert.match(readFileSync(await html.path(), 'utf8'), /输入一个整数 n/);
  await page.getByRole('button', { name: '随机练题' }).click({ force: true }).catch(async () => {
    await page.getByRole('button', { name: '打开菜单' }).click();
    await page.getByRole('button', { name: '随机练题' }).click();
  });
  await page.getByRole('button', { name: 'Codeforces' }).click();
  await page.waitForFunction(() => document.querySelector('.problem-topline .source')?.textContent === 'CODEFORCES');
  await page.getByRole('button', { name: '两站混合' }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.page-title-row h1').waitFor();
  await page.getByRole('button', { name: 'AtCoder' }).click();
  await page.waitForFunction(() => document.querySelector('.problem-topline .source')?.textContent === 'ATCODER');
  console.log(`Smoke test passed: source filters, draw, favorite, statement export, offline reload, mobile layout (${dimensions.inner}px)`);
} finally {
  await browser.close();
}
