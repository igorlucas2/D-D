# Base Ragnarok + avatar 3D

Status: **catálogo importado e avatar conectado**.
Última atualização: 28/10/2026.

## 1. Base de dados Ragnarok

Tabelas próprias, separadas das regras SRD:

| Tabela | Registros |
| --- | ---: |
| `RagnarokJob` | 97 classes nomeadas |
| `RagnarokSkill` | 1.732 skills |
| `RagnarokItem` | 14.397 itens nomeados |
| `RagnarokMap` | 965 mapas |

Fonte: `https://assets.latam-tools.com.br/raw/*` e `/maps/index.json`.

### Modelos

- `RagnarokJob`: `id`, `jt`, `name`, `hasIcon`.
- `RagnarokSkill`: `id`, `name`, `maxLevel`, `description`, `delay` (JSON de
  conjuração/recarga), `parent`.
- `RagnarokItem`: `id`, `name`, `slots`, `aegisName`, `resourceName`,
  `description`, `view`, `spriteView`, `spriteBlank`, `viewKind`, `equipSlots`,
  `costume`, `contains`.
- `RagnarokMap`: `name`.

Migrations:

- `20261028120744_ragnarok_catalog`
- `20261028123000_ragnarok_delay_json`
- `20261028124500_ragnarok_viewkind`

### Sincronização

```bash
cd backend
npm run build
node dist/src/scripts/sync-ragnarok.js
```

O script usa `skipDuplicates`, então pode rodar de novo sem duplicar. Entradas
sem nome são descartadas para não poluir o catálogo.

### API

Todas autenticadas:

- `GET /api/ragnarok/summary`
- `GET /api/ragnarok/classes?search=`
- `GET /api/ragnarok/skills?search=&take=&skip=`
- `GET /api/ragnarok/items?search=&take=&skip=&costume=`
- `GET /api/ragnarok/maps?search=`

OpenAPI agora tem **123 rotas**.

### Interface

`/library/ragnarok`:

- contadores;
- classes com sprite e `JT_*`;
- itens com slots/costume;
- skills com descrição;
- mapas;
- busca.

A Biblioteca ganhou o botão **Catálogo Ragnarok**.

## 2. Avatar 3D pela ficha

O modo imersivo lê `Character.appearance`, extrai o código `?b=` do link do
construtor e monta:

```text
/immersive/index.html?b=<build>#play/<mapa>
```

Assim o avatar local usa o visual salvo na ficha, em vez do aprendiz padrão.

Teste visual:

- `frontend/test-results/immersive-build-avatar.png` — build azul;
- `frontend/test-results/immersive-default-avatar.png` — aprendiz padrão.

A URL do construtor já era validada pela aba Visual; agora o código do build
também alimenta o viewer.

## 3. Limites

- o catálogo Ragnarok **não** altera as fichas SRD;
- ainda não há ficha Ragnarok própria (atributos, níveis, skills aprendidas);
- o avatar usa o primeiro personagem do jogador; seleção por campanha vem depois;
- posições de outros jogadores e combate 3D continuam na próxima fase;
- os dados são do cliente LATAM e podem mudar com atualização do ragassets.

## 4. Próxima fase

1. ficha Ragnarok separada (classe, nível, stats, skills);
2. escolher qual personagem entra na mesa imersiva;
3. sincronizar posição dos personagens;
4. combate 3D em turnos.

## 5. Validação

- sync: 97/1.732/14.397/965;
- `GET /ragnarok/summary` 200;
- busca de classe e item retornando UTF-8 correto;
- frontend build/lint/tsc;
- 212 testes backend;
- screenshot: `frontend/test-results/ragnarok-library2.png`.
