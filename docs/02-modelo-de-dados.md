# Modelo de Banco de Dados

> Implementado em `backend/prisma/schema.prisma`.
> Banco atual: **SQLite** (`backend/prisma/dev.db`). Migração para PostgreSQL:
> ver seção "Migração" no final deste documento.

## Entidades principais (MVP)

### User
Conta da plataforma.
- id, email, passwordHash, displayName, avatarUrl
- accountLevel, accountXp (níveis de experiência da conta)
- createdAt, updatedAt
- 1:N → Character, 1:N → Achievement (via UserAchievement), 1:N → CampaignMember

### Achievement / UserAchievement
Conquistas desbloqueáveis e relação N:N com usuários (com `unlockedAt`).

### Character
Personagem jogável.
- id, userId, name, race, class, subclass, background, alignment, deity
- appearance (texto/JSON), backstory (texto)
- level, xp
- strength, dexterity, constitution, intelligence, wisdom, charisma (atributos base)
- currentHp, tempHp, maxHp (calculado), armorClass (calculado), initiative (calculado)
- proficiencyBonus (calculado por nível)
- speed, portraitUrl
- 1:N → CharacterResistance, InventoryItem, CharacterSpell, DiceRoll

Campos calculados (modificadores, CA, iniciativa, vida, proficiência) são
recalculados no backend (`packages/shared/rules`) sempre que atributos/nível
mudam, e persistidos para leitura rápida pela ficha.

### CharacterResistance
- characterId, damageType, type (resistance | immunity | vulnerability)

### Item
Catálogo de itens (biblioteca).
- id, name, description, weight, value, rarity, category, properties (Json)

### InventoryItem
Relaciona Character ↔ Item (instância no inventário).
- id, characterId, itemId, quantity, equipped (bool), slot (enum: head, chest, mainHand, offHand, etc.)

### Spell
Catálogo de magias (biblioteca).
- id, name, school, level, range, duration, concentration (bool), description, classes (Json)

### CharacterSpell
- characterId, spellId, prepared (bool), slotsUsedTracking (via CharacterSpellSlot)

### CharacterSpellSlot
- characterId, level (1-9), total, used

### DiceRoll
Histórico de rolagens.
- id, userId, characterId?, campaignId?, formula (ex: "1d20+5"), result, breakdown (Json), createdAt

## Campanhas e Mesa Virtual

### Campaign
- id, name, description, masterId (User), worldId?
- inviteCode (link de convite)
- createdAt

### CampaignMember
- campaignId, userId, characterId?, role (master | player), joinedAt

### Session
- id, campaignId, title, scheduledAt, notes

### VttMap / VttToken (Mesa Virtual)
- VttMap: id, campaignId, name, width, height, imageUrl, gridSize, fogOfWarData (JSON serializado)
- VttToken: id, mapId, characterId?, name, x, y, size, color, imageUrl, visible

### CombatEncounter
- id, campaignId, mapId?, status (active|finished)
### CombatParticipant
- id, encounterId, characterId? (ou monsterName), initiative, currentHp, maxHp, conditions (Json), order

## Diário e Mundo

### JournalEntry
- id, campaignId, type (session|event|death|loot|decision), title, description, date

### World / Continent / Kingdom / Faction / Religion / Language
- Estrutura hierárquica simples (worldId em cada um), com campos de nome/descrição
- World também guarda `calendar` (Json: meses, dias por mês, eventos)

## Biblioteca (NPCs e Monstros)

### Monster
- id, name, stats (Json: atributos, CA, vida, ataques), challengeRating, description

### SrdResource
Cache local da D&D 5e SRD API.
- endpoint, index, name, url, source
- data (JSON original serializado), srdUpdatedAt, importedAt
- `endpoint + index` é único
- recursos principais também são mapeados para tabelas do app:
  - `monsters` → Monster
  - `spells` → Spell
  - `equipment` e `magic-items` → Item

### Npc
- id, campaignId?, name, description, role, statsRef (Monster opcional)

## IA para Mestres

### AiGeneration
- id, userId, type (npc|city|tavern|quest|monster|treasure|encounter)
- prompt, result (Json), createdAt
- (a chamada ao provedor de IA é feita pelo backend; resultado é cacheado aqui)

---

## Migração SQLite → PostgreSQL

1. Provisionar Postgres (ex.: `docker-compose` com imagem `postgres:16`)
2. Atualizar `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Atualizar `.env`: `DATABASE_URL="postgresql://user:pass@localhost:5432/rpgdb"`
4. Rodar `npx prisma migrate dev` (gera migrations compatíveis com Postgres)
5. (Opcional) script de export/import dos dados do SQLite para Postgres via
   `prisma db pull` + `prisma db push` ou ferramenta `pgloader`

Nenhuma query SQL bruta é usada no projeto — tudo via Prisma Client — então o
código da aplicação não precisa mudar.
