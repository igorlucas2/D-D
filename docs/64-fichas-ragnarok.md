# Fichas Ragnarok Online

Status: **CRUD separado do SRD usando o catálogo de classes**.
Última atualização: 28/10/2026.

## 1. Modelo

`RagnarokCharacter`:

| Campo | Uso |
| --- | --- |
| `userId` | dono |
| `jobId` | classe em `RagnarokJob` |
| `name` | nome |
| `level` | 1–200 |
| `strength` / `agility` / `vitality` | atributos |
| `intelligence` / `dexterity` / `luck` | atributos |
| `appearance` | link/código visual opcional |
| `createdAt` / `updatedAt` | auditoria |

Migration: `20261028140000_ragnarok_characters`.

FK de `userId` usa a collation `utf8mb4_0900_bin` da tabela `User`; a FK de
`jobId` aponta para `RagnarokJob`.

## 2. API

Autenticada:

- `GET /api/ragnarok/characters`
- `POST /api/ragnarok/characters`
- `PATCH /api/ragnarok/characters/:id`
- `DELETE /api/ragnarok/characters/:id`

Cada operação valida:

- ficha pertence ao usuário;
- classe existe em `RagnarokJob`;
- nome de 1–80 caracteres;
- nível 1–200;
- atributos 1–999.

## 3. Interface

`/library/ragnarok/characters`:

- formulário nome/classe/nível/atributos;
- lista com sprite da classe;
- atributos em cards;
- exclusão;
- botão **Fichas** no catálogo Ragnarok.

Teste:

- ficha `Teste Ragnarok`, Aprendiz, nível 10, FOR 15;
- criada, exibida e removida;
- banco voltou a 0 fichas.

Screenshot: `frontend/test-results/ragnarok-sheet.png`.

## 4. Limites

- ainda não entra no combate 5e;
- não há skills aprendidas, árvore de classe, HP/SP ou equipamento RO;
- o visual é um campo opcional, não o construtor;
- não há vínculo com a mesa imersiva ainda.

## 5. Próxima fase

- HP/SP e stats derivados por classe;
- skills aprendidas e árvore;
- equipamento RO com slots;
- escolher ficha Ragnarok para uma mesa própria;
- usar o visual no avatar 3D.
