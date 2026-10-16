// Turns the single-file hosted build into a body fragment for the Artifact tool (it adds the document skeleton).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-hosted/index.html', 'utf8');
const title = html.match(/<title>.*?<\/title>/s)[0];
const links = [...html.matchAll(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/g)].map((m) => m[0]).join('\n');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const styles = [...head.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
writeFileSync('dist-hosted/artifact.html', `${title}\n${links}\n${styles}\n${body}\n${scripts}\n`);
console.log('artifact.html', (readFileSync('dist-hosted/artifact.html').length / 1024).toFixed(0), 'KB');
