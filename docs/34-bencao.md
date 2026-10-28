# Abençoar (Bênção) — Fase L

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Segunda magia de concentração com efeito real: **Abençoar** (o catálogo usa
esse nome; “Bênção” no texto comum).

- alvo: 1 a 3 participantes;
- condição `Abençoado`;
- **+1d4 em ataques e salvaguardas**;
- concentração de **1 minuto**;
- mesma quebra por dano e encerramento manual da Marca.

## 2. Estado de concentração

`Character.concentration` agora guarda uma **lista de alvos**:

```json
{
  "spellName": "Abençoar",
  "targets": [
    { "kind": "PARTICIPANT", "id": "...", "name": "elfo" }
  ],
  "condition": "Abençoado",
  "bonusFormula": "1d4",
  "startedAt": "...",
  "expiresAt": "..."
}
```

O parser aceita o formato antigo de alvo único (Marca) e converte para lista.

## 3. Regras

`Abençoar` usa fallback do motor:

```ts
kind: 'BUFF'
targets: 'MULTIPLE'
concentration: {
  condition: 'Abençoado',
  bonusFormula: '1d4',
  durationMinutes: 1
}
```

- consome espaço e ação;
- exige 1–3 participantes;
- aplica `Abençoado` em cada alvo;
- grava os alvos na concentração;
- encerrar/quebrar remove a condição de todos;
- conjurar outra concentração encerra a anterior.

### Bônus

- **Ataque com arma** do conjurador abençoado: `+1d4` no total do ataque
  (não no dano).
- **Ataque mágico** do conjurador abençoado: `+1d4` no ataque.
- **Salvaguarda** de um alvo abençoado: `+1d4`.
- O bônus entra no resultado (`blessFormula`/`blessAmount`) e no cartão.

## 4. UI

- HUD mostra a concentração e **todos os alvos**.
- Diálogo de magia mostra `Abençoar` como **bênção** de concentração.
- Cartão do resultado mostra `Abençoado · +1d4 · 1 min`.
- Ataque mostra `+N bênção`.
- Abençoar não tem narração automática; aplica condição, não dano/cura imediato.

## 5. Limites

- Apenas Marca do Caçador e Abençoar têm mecânica de concentração.
- Alvos precisam ser participantes de combate.
- Duração em tempo real; expiração na próxima leitura.
- Bônus de salvaguarda só é aplicado em magias com save que o motor resolve.
- Não há bônus em testes de perícia, dano ou CD.

## 6. Teste real

- Combate com elfo e Goblin.
- `Abençoar` no elfo: **200**, `BUFF`, espaço `0 → 1`, condição `Abençoado`,
  concentração com alvo `elfo`, expiração em 1 min.
- Dois `end-turn` para voltar ao elfo.
- Ataque com Punhal:
  - `blessFormula = 1d4`;
  - `blessAmount = 1`;
  - total 6 vs CA 10 (errou);
  - o bônus foi rolado e entrou no ataque.
- `POST /combat/concentration/end`: **200**, concentração `null`, condição
  removida.
- Encontro, espaço, HP e ações de teste removidos.

## 7. Testes

- Fallback de Abençoar como `BUFF`, múltiplos alvos, condição, bônus e duração;
- parser de concentração com múltiplos alvos e compatibilidade com alvo único;
- **196 testes / 37 suítes**;
- OpenAPI: **117 rotas** (sem rota nova).
