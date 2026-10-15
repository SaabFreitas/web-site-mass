# Ascensão 🗳️

Jogo single-player de simulação e estratégia política para navegador, em estilo cartoon.
Você começa como vereador(a) de uma cidade pequena e tenta escalar até o poder mundial.

**Stack:** TypeScript + Vite + React, sem backend; o save fica no `localStorage`.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes da engine (Vitest)
npm run build    # build de produção em dist/
```

## Arquitetura

```
src/
├─ engine/   # lógica pura do jogo (sem React/DOM), 100% testável
│  ├─ rng.ts          RNG com seed (mulberry32), estado salvo no GameState
│  ├─ reducer.ts      gameReducer(state, action): ponto único de mudança de estado
│  ├─ turn.ts         fechamento do mês (finanças, decaimentos, escândalos, rival, eleição)
│  ├─ interview.ts    pontuação perfil × tom × contexto, combo, mentiras
│  ├─ election.ts     cálculo de votos
│  ├─ actions.ts      ações mensais
│  ├─ scandals.ts     escândalos pendentes
│  ├─ economy.ts      salário, despesas, juros
│  ├─ save.ts         serialização e validação do save
│  └─ __tests__/      testes unitários e simulação de balanceamento com bots
├─ data/     # conteúdo editável: perguntas, jornalistas, ações, temas, cidade, balanceamento
└─ ui/       # React: telas, componentes (avatares SVG), provider com autosave
```

Toda aleatoriedade passa pelo RNG com seed, então a mesma seed com as mesmas ações produz o mesmo jogo.
Para ajustar números do jogo, edite `src/data/balance.ts`.

## Fases

- [x] **Fase 1 (MVP):** 1 cidade, loop mensal, dinheiro simples, entrevista (32 perguntas, 4 perfis de jornalista), eleição no mês 6, fim de jogo, save/load
- [ ] Fase 2: investimentos, capital político, eventos aleatórios, gestão de crise, rival com IA
- [ ] Fase 3: níveis Estado e País, debate, comício, articulação, marketing
- [ ] Fase 4: bastidores, escândalos e investigação
- [ ] Fase 5: guerras e diplomacia
- [ ] Fase 6: nível Mundo, balanceamento, tutorial, polimento
