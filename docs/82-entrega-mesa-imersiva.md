# Entrega — mesa imersiva e base Ragnarok

Data: 28/10/2026.

## 1. O que foi entregue

### Mesa narrada
- preservada em `/campaigns/:id/play`;
- HUD, crônica, dados, itens, magias e combate continuam funcionando;
- nenhuma rota antiga foi removida.

### Mesa imersiva 3D
- viewer próprio em `/immersive`;
- avatar a partir de `Character.appearance`;
- avatar a partir de `RagnarokCharacter.appearance` (seletor **Visual SRD/RO**);
- troca de mapa com Lua/Eldoria;
- _pins_ do mapa do mundo levam à cena;
- NPCs ambientes e NPCs controlados pelo mestre;
- posição do jogador sincronizada com token VTT;
- movimento com bloqueio durante o turno de outro participante.

### Combate tático
- encontros no servidor, iniciativa e turnos;
- deslocamento em células de 5 pés;
- anel de alcance no viewer;
- alvo por clique no sprite/linha de iniciativa;
- ataque com arma, alcance por tipo e resultado;
- item e magia no turno;
- IA de inimigos e rodada automática;
- ledger `CombatAction` no Registro;
- flash de impacto e números flutuantes.

### Ragnarok
- 97 classes/jobs;
- 1.732 skills;
- 14.397 itens;
- 965 mapas;
- fichas com HP/SP, atributos e skills;
- link de visual usado no avatar imersivo;
- equipamento com busca no catálogo e equipar/desequipar.

## 2. Evidências de verificação

- backend:
  - `npx jest --runInBand`: **212 testes / 40 suítes**;
  - `eslint` e `tsc`: sem erros;
  - build: OK.
- frontend:
  - `npm run api:types:check`: tipos em dia;
  - `lint`: 0 erros;
  - `tsc`: OK;
  - build: OK.
- OpenAPI: **133 rotas**.
- banco:
  - 97 jobs;
  - 1.732 skills;
  - 14.397 itens;
  - 965 mapas;
  - 0 fichas de teste;
  - 0 equipamentos de teste;
  - 0 combates de teste;
  - 0 tokens de teste.
- app:
  - `/` 200;
  - `/library/ragnarok` 200;
  - `/campaigns/:id/immersive` 200;
  - `/immersive/index.html` 200;
  - CSS 200;
  - `/api/docs` 200.

## 3. Limites conhecidos

- sem cobertura/linha de visão no grid;
- magia sem área/alcance desenhados;
- IA sem pathfinding;
- equipamento Ragnarok sem bônus mecânicos;
- ficha Ragnarok não é a ficha ativa do combate 5e;
- sincronização de posição por polling, não por evento.

## 4. Como rodar

```powershell
.\Iniciar Eldoria.cmd
```

Portas: 3000 (web), 3001 (API), 11434 (Ollama).

## 5. Screenshots

- `frontend/test-results/immersive-ai-log.png`;
- `frontend/test-results/immersive-ro-visual.png`;
- `frontend/test-results/ragnarok-equipment.png`.
