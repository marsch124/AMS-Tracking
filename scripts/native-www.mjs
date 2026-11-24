// Assembles `www/` — the files the iPhone app carries inside it. The web app has
// no build step and keeps none: this only COPIES the same files GitHub Pages
// serves, and adds Capacitor's bridge script in front of the app's own scripts.
// Run by `npm run native:sync` (and by the iOS workflow) before `cap sync`.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const at = (p) => new URL(p, root);

rmSync(at('www'), { recursive: true, force: true });
mkdirSync(at('www/js'), { recursive: true });
for (const dir of ['css', 'js', 'icons']) cpSync(at(dir), at(`www/${dir}`), { recursive: true });
for (const file of ['manifest.json', 'version.json']) cpSync(at(file), at(`www/${file}`));
// No sw.js: a WKWebView has no service worker — the files are in the app itself.
cpSync(at('node_modules/@capacitor/core/dist/capacitor.js'), at('www/js/capacitor.js'));

const marker = '<script src="js/icons.js';
let html = readFileSync(at('index.html'), 'utf8');
if (!html.includes(marker)) throw new Error('index.html: the icons.js script tag was not found');
html = html.replace(marker, '<script src="js/capacitor.js"></script>\n    ' + marker);
writeFileSync(at('www/index.html'), html);
console.log('www/ assembled');
