# Ataque no combate imersivo

Status: **HUD de ataque conectada ao motor**.
Última atualização: 28/10/2026.

## 1. Ataque no mapa

Quando o turno atual pertence ao personagem do jogador:

- a HUD mostra **Atacar**;
- abre o diálogo de arma existente (`WeaponAttackDialog`);
- armas vêm do inventário da ficha;
- alvos vêm dos participantes do encontro;
- o diálogo prioriza um **inimigo** como alvo inicial;
- a requisição usa o mesmo endpoint do motor:

```http
POST /api/campaigns/:id/combat/attacks
{
  "requestKey": "<uuid>",
  "inventoryItemId": "...",
  "targetKind": "PARTICIPANT",
  "targetId": "..."
}
```

O servidor continua responsável por d20, CA, dano e economia de ação.

## 2. Carregamento da ficha

A página imersiva antes usava a listagem `/characters`, que não traz inventário.
Agora:

1. pega o primeiro personagem do jogador;
2. busca o detalhe `/characters/:id`;
3. usa `inventory` no diálogo de ataque.

Isso também corrige PV/CA exibidos na HUD quando a listagem vinha resumida.

## 3. Validação

Teste com personagem temporário + Espada Longa:

- HUD mostrou **Atacar** no turno do personagem;
- diálogo abriu com:
  - arma **Espada Longa (1d8 · cortante)**;
  - alvo **Poring**;
- o envio chegou ao motor;
- o motor recusou porque a ficha de teste não estava vinculada à campanha
  (`Personagem não vinculado a esta campanha`), o que confirma a checagem de
  vínculo;
- ficha, inventário e encontro de teste removidos.

Screenshot: `frontend/test-results/immersive-attack-real.png`.

## 4. Limites

- para atacar de verdade, a ficha precisa estar vinculada à campanha;
- o alvo ainda é escolhido no diálogo, não clicando no sprite;
- alcance/cobertura não são checados no grid 3D;
- magia e item continuam nos diálogos próprios;
- a HUD não mostra o resultado da rolagem; o painel de combate/evento recebe.

## 5. Próxima fase

- clicar no inimigo para selecionar alvo;
- desenhar alcance no chão;
- validar distância participante↔alvo;
- mostrar rolagem/dano na HUD;
- magia e item no mesmo fluxo.
