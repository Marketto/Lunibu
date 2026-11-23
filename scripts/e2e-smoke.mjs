// Prova di fumo nel browser: apre ogni sezione dell'app (IT/RU/EN) dalla build in dist/, salva gli screenshot in
// shots/ e fallisce se compaiono errori JavaScript. Uso: npm run build && npm run test:e2e
// Richiede Chromium (playwright: `npx playwright install chromium`, oppure CHROME_PATH).
import { preview } from 'vite';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const m of ['playwright', 'playwright-core', '/opt/npm-tools/node_modules/playwright']) {
    try { return require(m); } catch { /* prossimo */ }
  }
  throw new Error('playwright non trovato: npm i, poi npx playwright install chromium');
}
if (!existsSync(join(root, 'dist/index.html'))) { console.error('Manca dist/: esegui prima npm run build'); process.exit(1); }

const { chromium } = loadPlaywright();
const executablePath = process.env.CHROME_PATH || undefined;
const shots = join(root, 'shots');
mkdirSync(shots, { recursive: true });
const PORT = 4183;
const server = await preview({ root, preview: { port: PORT, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath });
const { TERMS_VERSION } = await import('../src/lib/terms.js');
const { TOUR } = await import('../src/data/tour.js');
const tourIds = TOUR.map((s) => s.id);

// Bimbo di prova di 4 anni con una misura, una temperatura e una medicina: abbastanza per aprire ogni vista.
const birth = new Date(Date.now() - 4.5 * 365.25 * 864e5).toISOString().slice(0, 10);
const day = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
const seed = (lang) => ({
  lang, accepted: true, terms: TERMS_VERSION, activeKid: 0,
  kids: [{ id: 'k1', name: 'Test', birth, sex: 'f' }],
  growth: [{ id: 'g1', kidId: 'k1', date: day, weight: 16, height: 103 }],
  temps: [{ id: 't1', kidId: 'k1', at: `${day}T10:00`, value: 37.8, site: 'ascella' }],
  meds: [], medPlans: [], milestones: []
});

const errors = [];
try {
  for (const lang of ['it', 'ru', 'en']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('pageerror', (e) => errors.push(`[${lang}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${lang}] console: ${m.text()}`); });
    await page.addInitScript(([st, seen]) => {
      localStorage.setItem('lunibu:v1', JSON.stringify(st));
      localStorage.setItem('lunibu:tour', JSON.stringify({ seen }));
    }, [seed(lang), tourIds]);
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(shots, `${lang}-home.png`) });
    for (const nav of ['nav-giochi', 'nav-suoni', 'nav-diario', 'nav-bimbi']) {
      const el = page.locator(`[data-tour="${nav}"]`).first();
      if (!(await el.count())) { errors.push(`[${lang}] manca ${nav}`); continue; }
      await el.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(shots, `${lang}-${nav}.png`) });
      if (nav === 'nav-diario') {
        // sotto-schede del diario (crescita, medicine, temperatura, tappe)
        const tabs = page.locator('[data-tour="diary-temp"]').locator('xpath=..').locator('button');
        const n = Math.min(await tabs.count(), 6);
        for (let i = 0; i < n; i++) {
          await tabs.nth(i).click({ timeout: 3000 }).catch((e) => errors.push(`[${lang}] tab diario ${i}: ${e.message.split('\n')[0]}`));
          await page.waitForTimeout(500);
          await page.screenshot({ path: join(shots, `${lang}-diario-${i}.png`) });
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`e2e: IT/RU/EN ok, screenshot in shots/`);
