import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const OUT_DIR = path.resolve('screenshots');

const CREDS = {
  email: 'estebanv144@gmail.com',
  password: '123321Aa',
};

const PUBLIC_PAGES = [
  { name: '01_landing',              path: '/' },
  { name: '02_login_pabellon',       path: '/login/pabellon' },
  { name: '03_login_doctor',         path: '/login/doctor' },
  { name: '04_recuperar_contrasena', path: '/recuperar-contrasena' },
  { name: '05_contacto',             path: '/contacto' },
  { name: '06_politica_privacidad',  path: '/politica-privacidad' },
];

const PABELLON_PAGES = [
  { name: '07_pabellon_dashboard',   path: '/pabellon' },
  { name: '08_pabellon_solicitudes', path: '/pabellon/solicitudes' },
  { name: '09_pabellon_calendario',  path: '/pabellon/calendario' },
  { name: '10_pabellon_bloqueo',     path: '/pabellon/bloqueo' },
  { name: '11_pabellon_medicos',     path: '/pabellon/medicos' },
  { name: '12_pabellon_insumos',     path: '/pabellon/insumos' },
  { name: '13_pabellon_correos',     path: '/pabellon/correos' },
  { name: '14_pabellon_auditoria',   path: '/pabellon/auditoria' },
];

const DOCTOR_PAGES = [
  { name: '15_doctor_dashboard',    path: '/doctor' },
  { name: '16_doctor_paciente',     path: '/doctor/paciente' },
  { name: '17_doctor_solicitudes',  path: '/doctor/solicitudes' },
  { name: '18_doctor_horarios',     path: '/doctor/horarios' },
  { name: '19_doctor_calendario',   path: '/doctor/calendario' },
];

function waitForServer(url, retries = 30, delay = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) return resolve();
      } catch {}
      if (++attempts >= retries) return reject(new Error('Dev server did not start'));
      setTimeout(check, delay);
    };
    check();
  });
}

async function shot(page, name) {
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

async function loginPabellon(page) {
  await page.goto(`${BASE_URL}/login/pabellon`, { waitUntil: 'networkidle2' });
  await page.type('#email', CREDS.email);
  await page.type('#password', CREDS.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
}

async function loginDoctor(page) {
  await page.goto(`${BASE_URL}/login/doctor`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#email', { timeout: 8000 });
  await page.type('#email', CREDS.email);
  await page.type('#password', CREDS.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
}

async function logout(page) {
  await page.goto(`${BASE_URL}/login/doctor`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
  });
  await new Promise(r => setTimeout(r, 500));
}

async function main() {
  const doctorOnly = process.argv.includes('--doctor-only');
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  // Start dev server
  console.log('Starting dev server...');
  const server = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore',
  });

  await waitForServer(BASE_URL);
  console.log('Dev server ready.\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    if (!doctorOnly) {
      // --- Public pages ---
      console.log('Public pages:');
      for (const p of PUBLIC_PAGES) {
        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        await shot(page, p.name);
      }

      // --- Pabellón (authenticated) ---
      console.log('\nPabellón pages (logging in as pabellón):');
      await loginPabellon(page);
      for (const p of PABELLON_PAGES) {
        await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        await shot(page, p.name);
      }
    }

    // --- Doctor (authenticated) ---
    console.log('\nDoctor pages (logging in as doctor):');
    await logout(page);
    await loginDoctor(page);
    for (const p of DOCTOR_PAGES) {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
      await shot(page, p.name);
    }

    console.log(`\nDone! Screenshots saved to: ${OUT_DIR}`);
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
