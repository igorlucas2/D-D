# Marca do Caçador e concentração — Fase K

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Implementar a primeira magia de **concentração** com efeito real:

- **Marca do Caçador** (nível 1, concentração, 1 hora);
- alvo marcado com a condição `Marcado`;
- ataques com arma do conjurador contra o alvo causam **+1d6**;
- concentração quebra ao tomar dano (salvaguarda de CON);
- duração de 1 hora;
- encerramento manual;
- UI mostra a concentração e permite encerrá-la.

## 2. Dados

`Character` ganha:

```prisma
concentration String? @db.Text
```

O campo guarda JSON:

```json
{
  "spellId": "...",
  "spellName": "Marca do Caçador",
  "targetKind": "PARTICIPANT",
  "targetId": "...",
  "targetName": "Goblin",
  "condition": "Marcado",
  "bonusFormula": "1d6",
  "startedAt": "2026-10-28T00:00:00.000Z",
  "expiresAt": "2026-10-28T01:00:00.000Z"
}
```

Migração `20261028001456_concentration`.

## 3. Mecânica da magia

`Marca do Caçador` não tem `Spell.mechanics` no catálogo; o motor usa fallback
por nome:

```ts
kind: 'MARK'
concentration: {
  condition: 'Marcado',
  bonusFormula: '1d6',
  durationMinutes: 60
}
targets: 'SINGLE'
```

Regras:

- exige exatamente **um participante** em combate;
- consome espaço de magia e **ação**;
- adiciona `Marcado` ao alvo;
- grava a concentração no conjurador;
- conjurar outra concentração encerra a anterior;
- um ataque com arma do conjurador contra o alvo marcado adiciona `1d6` ao
  dano (não é dobrado no crítico).

## 4. Quebra e duração

- Dano ao conjurador: salvaguarda de CON, CD `max(10, dano/2)`.
- Falha: concentração encerra e `Marcado` é removido.
- `expiresAt` é checado quando a concentração é lida; expirada, encerra e
  remove a condição.
- `POST /campaigns/:id/combat/concentration/end` encerra manualmente.
- O endpoint exige dono do personagem ou mestre.

## 5. UI

- HUD mostra **Concentração: Marca do Caçador em X**.
- Botão **Encerrar concentração**.
- Diálogo de magia mostra `Marca do Caçador` com etiqueta de concentração.
- Cartão do resultado mostra `Marcado · +1d6 · 1 h`.
- Cartão do ataque mostra `+N da Marca`.
- Marca **não** tem narração automática: não há dano/cura aplicado no ato de
  conjurar; a condição é o efeito.

## 6. Limites

- Apenas Marca do Caçador usa concentração por enquanto.
- Alvo precisa ser participante de combate; não há marca em ficha fora de
  combate.
- Duração é em tempo real, não em rodadas.
- A expiração é aplicada na próxima leitura da concentração (ataque, estado ou
  encerramento), não por um job periódico.
- O bônus só vale para ataques com arma do conjurador.
- A condição `Marcado` não é contada como condições de PV/descanso.

## 7. Teste real

Combate com elfo e Goblin:

- Marca conjurada: **200**, espaço nível 1 `0 → 1`, alvo `Marcado`,
  concentração JSON gravada, expira em 1 h.
- Dois `end-turn` para voltar ao elfo.
- Ataque com Punhal: **acertou**, **14 de dano**, sendo **2 da Marca**
  (`markFormula 1d6`).
- Dano 100 no conjurador com CON temporariamente baixa: concentração `null` e
  condição `Marcado` removida.
- Encontro, ações, espaço e atributos restaurados.

## 8. Testes

- Fallback de Marca com `kind= MARK`, condição, bônus e duração;
- parse de concentração válida/inválida;
- **194 testes / 37 suítes**;
- OpenAPI: **117 rotas**.
