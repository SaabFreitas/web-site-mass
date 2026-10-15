// Gera ascensao.html: o jogo inteiro em um único arquivo, que abre direto do disco.
// Uso: npm run build:arquivo
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dist, src), 'utf8').replaceAll('</script', '<\\/script');
  return `<script type="module">${js}</script>`;
}).replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8');
  return `<style>${css}</style>`;
});

if (/(src|href)="\.\/assets/.test(html)) throw new Error('Sobrou referência a arquivo externo em dist/');
writeFileSync('ascensao.html', html);
console.log(`ascensao.html gerado (${Math.round(html.length / 1024)} KB)`);
