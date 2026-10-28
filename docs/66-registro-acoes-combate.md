# Registro de ações no combate imersivo

Status: **histórico curto na HUD**.
Última atualização: 28/10/2026.

## 1. Fonte

`GET /api/campaigns/:id/combat/actions?take=8`

Retorna os `CombatAction` mais recentes, já com o resultado parseado. O mestre vê
todas as ações; o jogador vê as próprias.

## 2. HUD

Abaixo do deslocamento:

```text
REGISTRO
Golpe de teste · Poring        3 PV
```

- 5 entradas mais recentes;
- `source` ou `kind`;
- alvo;
- PV aplicados ou última condição resultante.

Atualiza a cada **3 s** enquanto há combate.

## 3. Teste

Encontro `Log 3D`:

- Guarda e Poring;
- ação de dano de 3 PV, fonte `Golpe de teste`;
- HUD mostrou `Golpe de teste · Poring  3 PV`;
- Poring caiu de 12 para 9 PV;
- encontro removido.

Screenshot: `frontend/test-results/immersive-action-log.png`.

## 4. Limites

- não há paginação/rolagem infinita;
- só o combate atual;
- não substitui a crônica narrativa;
- ação de magia/item aparece se registrada em `CombatAction`.

## 5. Próxima fase

- histórico maior com filtro;
- ícones por tipo de ação;
- animação de dano no sprite;
- IA dos inimigos.
