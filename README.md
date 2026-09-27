# Portal do Avesso

Jogo de plataforma 2D no navegador, em cartoon épico com sombras e proporções exageradas. O **Agente Vulto** abre portais entre o **Mundo Normal** e o **Mundo Avesso**, atravessa o mapa abatendo alienígenas e enfrenta o **Soberano Mil-Olhos** na colmeia.

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
- Plataformas de aço só existem no Mundo Normal; cristais alienígenas só existem no Avesso. Contornos tracejados mostram os blocos do outro mundo.
- Cada mundo tem inimigos próprios. Os do outro mundo aparecem como silhuetas paradas com marcadores, e os do mundo de chegada ficam congelados por um instante depois da travessia, para você saber onde estão.
- Os Fragmentos do Avesso só existem no Avesso.

## Quests

1. Passar pela barricada blindada (só some no Avesso).
2. Voltar ao Normal para cruzar a ponte de aço.
3. Recuperar os 3 Fragmentos do Avesso: escadaria de cristal (Avesso), rocha alta (subir pelo aço no Normal e abrir portal lá em cima) e o Guardião do Avesso.
4. Abrir o Portão da Colmeia com os fragmentos.
5. Chefe: o coração do Soberano só fica exposto em um mundo. Na segunda fase ele troca de mundo a cada poucos segundos.

`?debug` na URL habilita atalhos de teste (1–7 teleporta, G modo deus, R +1 fragmento, V troca de mundo).
