# Narração de ataques com arma — Fase J

Status: **implementada**.
Última atualização: 27/10/2026.

## 1. Objetivo

Fechar o ciclo entre o ataque com arma e a crônica. O jogador ataca, o motor
resolve d20/CA/dano e o mestre pode narrar **aquele resultado já aplicado**.

Ataques com arma têm fonte e alvo claros, então não sofrem a restrição que
tivemos em dano manual sem autoria.

## 2. Fluxo

```text
POST /combat/attacks
→ CombatAction WEAPON_ATTACK + resultado aplicado
→ cartão "Ataque com Punhal"
→ "Narrar consequência"
→ POST /ai-master/narrate-action
→ fatos extraídos do ledger
→ prompt de resultado + schema fechado
→ StoryEvent público
```

## 3. Fatos enviados ao modelo

`describeMechanicalResult('WEAPON_ATTACK', result)` produz:

- arma;
- alvo;
- acerto/erro/crítico;
- total vs CA;
- dano aplicado e tipo;
- PV final;
- recurso `arma <nome>`.

O modelo não calcula nada; só recebe o resultado.

## 4. Validação

- A ação precisa ser `WEAPON_ATTACK` (além de item/magia).
- O ator ou mestre precisa ter permissão.
- A narração precisa:
  - citar o alvo nominalmente;
  - descrever acerto/erro/crítico/dano;
  - citar o resultado numérico aplicado.
- A narração é persistida como evento público e esconde o botão pelo
  `sourceActionId`.

## 5. UI

- O botão **Narrar consequência** aparece também no cartão do último ataque com
  arma.
- O texto entra no topo da crônica.
- Nada é recalculado; a ficha/combate não mudam ao narrar.

## 6. Limites

- Ajustes manuais de dano/cura/condição continuam **sem** narração automática.
- Ataques desarmados ainda não existem.
- A narração não cria efeitos, condições ou dano novo.
- O modelo pode variar a prosa; os números e alvos vêm do motor.

## 7. Teste real

- Combate com elfo e um Goblin de teste.
- Punhal: ataque **200**, acertou, **4 de dano**, alvo **10 → 6 PV**.
- Narração produzida:
  > “O punhal do elfo encontrou o alvo com precisão, perfurando o Goblin de
  > teste por 4 pontos de dano piercing. O Goblin de teste agora tem 6 PV.”
- Latência: **17,9 s**.
- Evento e ações de teste removidos; HP restaurado.

## 8. Testes

- Unitário de fatos: ação, crítico, dano/tipo e PV.
- **191 testes / 36 suítes**.
- OpenAPI: **116 rotas** (sem rota nova).
