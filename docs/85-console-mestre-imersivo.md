# Console do Mestre na mesa imersiva

Status: **narrar, rolar dados, invocar boss, dar item e subir nível sem sair do mapa**.
Última atualização: 28/10/2026.

## 1. Por que

A Mesa Virtual antiga exigia sair do mapa imersivo para narrar. O Console do
Mestre concentra as ações de sessão na própria HUD.

## 2. Onde

- topo do mapa: **Dados** e **Narrar**;
- aba **Mestre** (somente mestre);
- aba **Ficha de Eldoria**;
- seção **Portais** e lista de NPCs.

## 3. Comandos

### Narrar
Abre o `NarrationComposer` existente dentro de um modal:

- público;
- rascunhos;
- registrar no diário;
- vínculo com o mapa atual.

### Dados
Abre `TableDiceControls`:

- d4 a d100;
- quantidade/modificador;
- visibilidade;
- histórico da campanha.

### Invocar boss
1. garante um encontro de combate;
2. cria o token do boss no centro do mapa;
3. cria o participante inimigo com PV/iniciativa;
4. posiciona o participante na célula do token.

### Dar item
- catálogo SRD (`/catalog/items`);
- personagem vinculado à campanha;
- endpoint novo:

```http
POST /api/campaigns/:id/master/grant-item
```

### Subir nível / classe
```http
POST /api/campaigns/:id/master/level-up
```

Recalcula PV máximo, CA, iniciativa e proficiência pelo motor de regras.

## 4. Permissões

Os dois endpoints novos validam:

- `campaign.masterId === userId`;
- personagem vinculado via `CampaignCharacter`.

## 5. Testes

- **Narrar** abriu o modal e o compositor;
- **Dados** abriu a bandeja e o histórico;
- **Mestre** exibiu boss, item e nível;
- backend: **212 testes / 40 suítes**;
- OpenAPI: **135 rotas**.

Screenshot: `frontend/test-results/master-console.png`.

## 6. Limites

- o catálogo de item é o SRD, não os 14.397 itens Ragnarok;
- nível/ classe altera ficha 5e, não job Ragnarok;
- boss usa sprite de criatura e ainda não tem habilidades de boss;
- item/nível exigem personagem vinculado;
- a Mesa Virtual antiga continua existindo como administração/legado;
- a HUD imersiva é a mesa de sessão.

## 7. Próxima fase

- itens Ragnarok no console;
- jobs/classes Ragnarok no nível;
- habilidades e fases de boss;
- iniciativa automática para boss;
- logs de auditoria visíveis na HUD.
