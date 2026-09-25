# Duelo Divino

Jogo de luta 2D para navegador, feito do zero em HTML5 Canvas e JavaScript puro, com arte em estilo anime desenhada por código (sem imagens) e personagens em proporções realistas.

## Como jogar

Abra `index.html` no navegador. Não precisa instalar nada nem rodar servidor.

- **1 Jogador:** você contra a CPU (Fácil, Normal ou Difícil).
- **2 Jogadores:** no mesmo teclado ou com dois controles.
- **Modo História:** em produção.

| Ação | Jogador 1 | Jogador 2 |
|---|---|---|
| Andar / pular / agachar | A D / W / S | ← → / ↑ / ↓ |
| Golpe leve | G | L (Num 1) |
| Golpe forte | H | K (Num 2) |
| Especial | T | O (Num 3) |
| Dash | Y | I (Num 0) |

- Segure **para trás** para defender. Agachado defende rasteiras; em pé defende ataques aéreos.
- **Especial** parado solta um projétil, **frente + Especial** é uma investida, **trás + Especial** é um golpe anti-aéreo.
- Com a energia cheia, **baixo + Especial** solta o **SUPER**, com animação de corte.
- Leve → Forte → Especial encadeia combos.
- Controles de videogame funcionam (X leve, Y forte, B especial, A dash).

## Lutadores

- **Taiga**, o Punho de Brasa: irmão mais velho, luta com os punhos e com fogo.
- **Yukine**, a Lâmina do Vento: irmã caçula, espadachim com katana e cortes de vento.

## Estrutura

```
index.html            página e ordem dos scripts
css/style.css         layout 16:9 responsivo
js/util.js            constantes, cores, formas e canvas em resolução HD
js/input.js           teclado e gamepad
js/audio.js           efeitos sonoros sintetizados (Web Audio)
js/data.js            poses do esqueleto e dados dos personagens e golpes
js/render-fighter.js  desenho anime dos lutadores (cel shading, rosto, cabelo)
js/fighter.js         estados, golpes, física e esqueleto de cada lutador
js/fx.js              impactos, partículas e projéteis
js/stage.js           cenário com paralaxe (Santuário do Mestre Lagarto)
js/ai.js              CPU
js/game.js            telas, rounds, HUD, super, câmera e laço principal
```
