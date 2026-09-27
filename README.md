# Portal do Avesso

Jogo de plataforma 2D no navegador. O mago abre portais entre o **Reino Encantado** e o **Mundo Avesso**, atravessa o mapa derrotando criaturas bizarras e enfrenta o **Rei Bizarro Mil-Olhos** no castelo.

Para jogar, abra `index.html` (ou sirva a pasta com qualquer servidor estático, ex.: `npx http-server .`). Não há dependências nem assets externos: a arte é toda desenhada em código no `game.js`.

## Controles

| Ação | Teclado | Mouse / toque |
| --- | --- | --- |
| Andar | ← → ou A D | botões ◀ ▶ |
| Pular | Espaço, W ou ↑ | ▲ |
| Atirar | J ou X | clique (mira no cursor) / TIRO |
| Dash | Shift ou K | DASH |
| Abrir portal | E ou Q | botão direito / PORTAL |
| Pausar · som | P · M | II |

## Como os portais funcionam

- `E` abre um portal à sua frente; ao atravessá-lo você troca de mundo. Atravessar recarrega o pulo (ganha um pulo no ar) e o dash.
- Blocos de vinha só existem no Mundo Normal; blocos de cristal só existem no Avesso. Contornos tracejados mostram os blocos do outro mundo.
- Cada mundo tem inimigos próprios. As Runas do Avesso só existem no Avesso.

## Quests

1. Atravessar o muro de espinhos (só some no Avesso).
2. Voltar ao Normal para cruzar a ponte do Reino.
3. Coletar as 3 Runas do Avesso: escada de cristal (Avesso), rocha alta (subir no Normal e abrir portal lá em cima) e o Guardião do Avesso.
4. Abrir o Portão do Castelo com as runas.
5. Chefe: o núcleo do Rei só fica exposto em um mundo. Na segunda fase ele troca de mundo a cada poucos segundos.

`?debug` na URL habilita atalhos de teste (1–7 teleporta, G modo deus, R +1 runa, V troca de mundo).
