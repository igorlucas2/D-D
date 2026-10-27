# Fluxos de Navegação e Wireframes (texto)

## Fluxo geral

```
Landing (/)
 ├─ /login
 ├─ /register
 └─ (autenticado) /dashboard
      ├─ /characters                (lista de personagens)
      │    ├─ /characters/new       (wizard de criação)
      │    └─ /characters/:id       (ficha interativa)
      │         ├─ aba: Atributos
      │         ├─ aba: Inventário
      │         ├─ aba: Magias
      │         └─ aba: História/Aparência
      ├─ /campaigns                 (lista de campanhas)
      │    ├─ /campaigns/new
      │    └─ /campaigns/:id
      │         ├─ /campaigns/:id/table     (mesa virtual / VTT)
      │         ├─ /campaigns/:id/combat    (gerenciador de combate)
      │         ├─ /campaigns/:id/journal   (diário)
      │         └─ /campaigns/:id/settings  (participantes, convite, calendário)
      ├─ /library                   (regras, monstros, itens, magias, NPCs)
      ├─ /world                     (continentes, reinos, facções...)
      ├─ /ai-master                 (assistente de IA)
      └─ /profile                   (perfil, avatar, conquistas, nível)
```

## Wireframe — Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ LOGO   Personagens  Campanhas  Biblioteca  Mundo  IA  👤  │
├──────────────────────────────────────────────────────────┤
│  Bem-vindo, {nome}!            Nível de conta: 5 ▓▓▓▓░ 80%│
│                                                            │
│  ┌─ Meus Personagens ─────────┐  ┌─ Minhas Campanhas ───┐ │
│  │ [Retrato] Thalion - Nv 4    │  │ A Sombra de Eldoria  │ │
│  │ [Retrato] Korrath - Nv 1    │  │ Próx. sessão: dom 20h│ │
│  │ [+ Criar personagem]        │  │ [+ Criar campanha]   │ │
│  └──────────────────────────────┘  └──────────────────────┘│
│  Conquistas recentes: 🏆 Primeiro Personagem  🏆 ...       │
└──────────────────────────────────────────────────────────┘
```

## Wireframe — Ficha Interativa

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────┐  Thalion Vaeloris   Nv 4 Guerreiro (Campeão) │
│ │ RETRATO  │  Humano · Acólito · Leal e Bom · Tyrwin       │
│ │  GRANDE  │  XP ▓▓▓▓▓▓▓░░░ 7000/10000                     │
│ └──────────┘                                               │
│  HP 38/45     Slots 3/4     CA: 17                         │
├───────────────┬──────────────────────┬───────────────────┤
│ ATRIBUTOS     │  INVENTÁRIO (drag&drop)│  MAGIAS           │
│ FOR 16 (+3)   │  [Espada Longa] equip. │  Slots Nv1: ●●○   │
│ DES 14 (+2)   │  [Escudo]       equip. │  Curar Ferimentos │
│ CON 15 (+2)   │  [Poção de Cura] x3    │  Bola de Fogo     │
│ INT 10 (+0)   │  [Mochila ▾]           │  [+ adicionar]    │
│ SAB 12 (+1)   │  Peso: 45/80           │                   │
│ CAR 13 (+1)   │  [🔍 buscar item]      │                   │
├───────────────┴──────────────────────┴───────────────────┤
│ Iniciativa +2 · Proficiência +2 · Resistências: Fogo       │
│ História | Aparência | Equipamentos                        │
└──────────────────────────────────────────────────────────┘
```

## Wireframe — Mesa Virtual (VTT)

```
┌──────────────────────────────────────────────────────────┐
│ Campanha: A Sombra de Eldoria        [Iniciativa] [Chat]  │
├───────────────────────────────────────┬──────────────────┤
│                                         │ Iniciativa       │
│         (grid + tokens + fog)          │ 1. Thalion  18   │
│                                         │ 2. Goblin#1 15   │
│                                         │ 3. Korrath  12   │
│   [Token jogador]   [Token monstro]    │ 4. Goblin#2  8   │
│                                         │                  │
│   Ferramentas: 🖌 grid | 👁 fog |       │ [Próximo turno]  │
│   📏 medir | 🎯 marcador               │                  │
└───────────────────────────────────────┴──────────────────┘
```

## Wireframe — Rolagem de Dados

```
┌───────────────────────────────┐
│   [D4][D6][D8][D10][D12][D20][D100] │
│                                 │
│        🎲 cena 3D com física    │
│                                 │
│   Resultado: 17  (1d20+5 = 12+5)│
├─────────────────────────────────┤
│ Histórico:                      │
│ - 1d20+5 = 17 (Thalion, Ataque) │
│ - 2d6 = 9 (Dano)                │
└─────────────────────────────────┘
```

## Wireframe — Criação de Personagem (wizard)

```
Etapa 1: Identidade  → Nome, Raça, Classe, Subclasse, Antecedente, Alinhamento, Divindade
Etapa 2: Atributos   → distribuir pontos (FOR/DES/CON/INT/SAB/CAR) + preview de modificadores
Etapa 3: Aparência e História → texto livre + upload de retrato
Etapa 4: Revisão     → mostra CA, Vida, Iniciativa, Proficiência calculados → [Criar]
```
