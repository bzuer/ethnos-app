import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = __dirname + '/../public/css/styles.css';
const minPath = __dirname + '/../public/css/styles.min.css';

const css = readFileSync(srcPath, 'utf8');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const min = noComments.replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim();
writeFileSync(minPath, min, 'utf8');
