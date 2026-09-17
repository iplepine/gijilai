#!/usr/bin/env node

// Public-flow browser regression check. Requires a running local Next.js server.
// Usage: GIJILAI_QA_BASE_URL=http://localhost:3100 node scripts/verify-growth-flow.cjs
// No real login, clipboard access, external SDK/analytics request, or API write.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const ko = require('../src/i18n/messages/ko.json');
const en = require('../src/i18n/messages/en.json');

const baseUrl = new URL(process.env.GIJILAI_QA_BASE_URL || 'http://localhost:3100');
assert(['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname), 'QA must target a local server');
const outputDir = process.env.GIJILAI_QA_OUTPUT_DIR || '/tmp/gijilai-growth-qa';
const scenarios = ['transition', 'separation', 'tantrum'];
const expectedLoginHref = '/login?redirect=%2Fintake';
const results = { checks: [], pageErrors: [], consoleErrors: [], blockedExternalRequests: 0, blockedApiWrites: [] };

function record(name) {
  results.checks.push(name);
  console.log(`PASS ${name}`);
}

async function prepareContext(browser, viewport, localeCookie = 'ko') {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', serviceWorkers: 'block' });
  context.setDefaultTimeout(15000);
  await context.addCookies([{ name: 'gijilai_locale', value: localeCookie, url: baseUrl.origin }]);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== baseUrl.origin) {
      results.blockedExternalRequests += 1;
      // Empty local responses keep SDKs/analytics/fonts from reaching remote services.
      const resourceType = request.resourceType();
      const contentType = resourceType === 'script' ? 'application/javascript'
        : resourceType === 'stylesheet' ? 'text/css' : 'text/plain';
      return route.fulfill({ status: 200, contentType, body: '' });
    }
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method())) {
      results.blockedApiWrites.push(`${request.method()} ${url.pathname}`);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  await context.addInitScript(() => {
    window.__growthQaClipboard = { mode: 'success', writes: [] };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (window.__growthQaClipboard.mode === 'denied') {
            throw new DOMException('Synthetic clipboard denial', 'NotAllowedError');
          }
          window.__growthQaClipboard.writes.push(text);
        },
      },
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => results.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') results.consoleErrors.push(message.text());
  });
  return { context, page };
}

async function open(page, pathname) {
  const response = await page.goto(new URL(pathname, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert(response?.ok(), `Page did not load successfully: ${pathname}`);
}

async function noHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert(dimensions.document <= dimensions.viewport + 1, `${label}: document overflow ${JSON.stringify(dimensions)}`);
  assert(dimensions.body <= dimensions.viewport + 1, `${label}: body overflow ${JSON.stringify(dimensions)}`);
}

async function verifyLoginLink(locator) {
  assert.equal(await locator.getAttribute('href'), expectedLoginHref);
  const target = new URL(await locator.getAttribute('href'), baseUrl);
  assert.equal(target.pathname, '/login');
  assert.equal(target.searchParams.get('redirect'), '/intake');
}

async function verifyScenario(page, scenario, messages) {
  const selected = page.getByRole('link', { name: messages.preview[scenario].label, exact: true });
  await page.getByRole('heading', { name: messages.preview[scenario].title, exact: true }).waitFor();
  assert.equal(await selected.getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('blockquote').textContent(), messages.preview[scenario].phrase);
  assert.equal(await page.getByRole('navigation', { name: messages.preview.chooseScenario }).getByRole('link').count(), 3);
  await verifyLoginLink(page.getByRole('link', { name: messages.preview.startTest, exact: true }));
}

async function runKoreanFlow(browser, label, viewport) {
  const { context, page } = await prepareContext(browser, viewport);
  try {
    await open(page, '/');
    // The hero includes an icon text node and the lower CTA starts in ScrollReveal.
    const webLinks = page.locator('a').filter({ hasText: ko.landing.startWeb });
    await webLinks.first().waitFor();
    assert.equal(await webLinks.count(), 2);
    await verifyLoginLink(webLinks.first());
    await verifyLoginLink(webLinks.last());
    await noHorizontalOverflow(page, `${label} landing`);
    await page.screenshot({ path: path.join(outputDir, `${label}-landing.png`), fullPage: true });
    await webLinks.first().click();
    await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/intake');
    record(`${label}: landing web CTA keeps child intake before assessment`);

    await open(page, '/preview');
    await page.getByRole('heading', { name: ko.preview.title, exact: true }).waitFor();
    await verifyScenario(page, 'transition', ko);
    for (const scenario of scenarios) {
      await page.getByRole('link', { name: ko.preview[scenario].label, exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/preview' && url.searchParams.get('scenario') === scenario);
      await verifyScenario(page, scenario, ko);
      await noHorizontalOverflow(page, `${label} ${scenario}`);
    }
    record(`${label}: three scenario URLs, selected states, examples and signup links`);

    const copyButton = page.getByRole('button', { name: ko.preview.copyLink, exact: true });
    await copyButton.click();
    await page.getByRole('status').filter({ hasText: ko.preview.copied }).waitFor();
    const shareUrl = 'https://gijilai.com/preview?scenario=tantrum';
    assert.deepEqual(await page.evaluate(() => window.__growthQaClipboard.writes), [shareUrl]);
    record(`${label}: copying writes only the chosen public example URL`);

    await page.evaluate(() => { window.__growthQaClipboard.mode = 'denied'; });
    await copyButton.click();
    await page.getByRole('status').filter({ hasText: ko.preview.copyFailed }).waitFor();
    const fallback = page.getByRole('textbox', { name: ko.preview.copyLink, exact: true });
    assert.equal(await fallback.inputValue(), shareUrl);
    assert.equal(await fallback.getAttribute('readonly'), '');
    await fallback.click();
    assert.equal(await fallback.evaluate((input) => input.selectionEnd - input.selectionStart), shareUrl.length);
    await noHorizontalOverflow(page, `${label} clipboard fallback`);
    await page.screenshot({ path: path.join(outputDir, `${label}-clipboard-fallback.png`), fullPage: true });
    record(`${label}: denied clipboard offers a selectable URL without overflow`);

    await open(page, '/preview?scenario=not-a-scenario');
    await verifyScenario(page, 'transition', ko);
    await noHorizontalOverflow(page, `${label} invalid scenario`);
    assert(!(await page.locator('main').innerText()).includes('not-a-scenario'));
    record(`${label}: invalid scenario falls back to transition without reflecting input`);

    await page.getByRole('link', { name: ko.preview.startTest, exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('redirect') === '/intake');
    record(`${label}: example CTA reaches login with the intake destination`);
  } finally {
    await context.close();
  }
}

async function runEnglishAndSsr(browser) {
  const { context, page } = await prepareContext(browser, { width: 390, height: 844 }, 'en');
  try {
    const response = await context.request.get(new URL('/preview?scenario=separation', baseUrl).href);
    assert(response.ok());
    const html = await response.text();
    assert(html.includes(ko.preview.separation.title), 'The initial HTML must contain the example title');
    assert(html.includes(ko.preview.separation.phrase), 'The initial HTML must contain the example phrase');
    assert(html.includes(ko.preview.sampleLabel), 'The initial HTML must identify the example as fictional');
    record('SSR: example title, phrase and fictional-situation label exist before JavaScript');

    await open(page, '/preview?scenario=separation');
    await page.getByRole('heading', { name: en.preview.title, exact: true }).waitFor();
    await verifyScenario(page, 'separation', en);
    await noHorizontalOverflow(page, 'English mobile preview');
    await page.screenshot({ path: path.join(outputDir, 'mobile-english-preview.png'), fullPage: true });
    await open(page, '/');
    const webLink = page.locator('a').filter({ hasText: en.landing.startWeb }).first();
    await webLink.waitFor();
    await verifyLoginLink(webLink);
    await noHorizontalOverflow(page, 'English mobile landing');
    record('English locale cookie overrides Korean browser language on landing and preview');
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runKoreanFlow(browser, 'desktop', { width: 1440, height: 1000 });
    await runKoreanFlow(browser, 'mobile', { width: 390, height: 844 });
    await runEnglishAndSsr(browser);
    assert.deepEqual(results.blockedApiWrites, [], 'The public flow attempted API writes');
    assert.deepEqual(results.pageErrors, [], 'Browser runtime errors occurred');
    assert.deepEqual(results.consoleErrors, [], 'Browser console errors occurred');
    record('No API writes, page errors or console errors; external analytics and SDK traffic blocked');
    results.status = 'passed';
  } catch (error) {
    results.status = 'failed';
    results.failure = error.message;
    throw error;
  } finally {
    await browser.close();
    await fs.writeFile(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
    console.log(`QA artifacts: ${outputDir}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
