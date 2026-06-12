/* Shared jsdom harness for Emberforge headless testing */
import jsdomPkg from 'jsdom';
const { JSDOM, requestInterceptor } = jsdomPkg;
import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { fileURLToPath } from 'url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const localFiles = requestInterceptor((request) => {
  const u = new URL(request.url);
  const file = path.join(ROOT, u.pathname);
  const type = file.endsWith('.js') ? 'application/javascript'
    : file.endsWith('.css') ? 'text/css' : 'text/html';
  try {
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': type } });
  } catch (e) {
    return new Response('', { status: 404 });
  }
});

export async function boot(opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/index.html',
    runScripts: 'dangerously',
    resources: { interceptors: [localFiles] },
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  window.__errors = errors;
  window.addEventListener('error', e => errors.push(e.error ? (e.error.stack || e.error.message) : e.message));
  if (opts.storage) {
    for (const [k, v] of Object.entries(opts.storage)) window.localStorage.setItem(k, v);
  }
  await new Promise(res => {
    window.addEventListener('load', res);
    setTimeout(res, 5000); // safety
  });
  const ctx = dom.getInternalVMContext();
  const run = (expr) => vm.runInContext(expr, ctx, { filename: '<test>' });
  return { dom, window, errors, run };
}

export function click(window, el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function activeScreen(window) {
  const s = window.document.querySelector('.screen.active');
  return s ? s.id : null;
}

export function dumpStorage(window) {
  const out = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    out[k] = window.localStorage.getItem(k);
  }
  return out;
}
