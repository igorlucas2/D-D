# Alcance numérico de armas à distância

Status: **armas ranged validadas por alcance**.
Última atualização: 28/10/2026.

## 1. Mapa de alcances SRD

| Arma (`srdIndex`) | Alcance |
| --- | ---: |
| `shortbow` | 80 pés |
| `longbow` | 150 pés |
| `lightcrossbow` | 80 pés |
| `heavycrossbow` | 100 pés |
| `handcrossbow` | 30 pés |
| `sling` | 30 pés |
| `dart` | 20 pés |
| `javelin` | 30 pés |
| `blowgun` | 25 pés |
| ranged sem índice | 60 pés |
| corpo a corpo | 5 pés |

## 2. Regra

`parseWeaponMechanics` agora devolve `rangeFeet`.

`WeaponAttackService` valida:

```text
distância × 5 > rangeFeet → 400
Alvo fora do alcance (80 pés): 120 pés.
```

A regra vale para corpo a corpo e à distância.

## 3. Limites

- alcance de magia não usa esta tabela;
- sem cobertura/linha de visão;
- a HUD não mostra o alcance da arma ainda;
- armas fora da tabela usam 60 pés.

## 4. Próxima fase

- mostrar alcance no diálogo;
- cobertura;
- munição;
- magia com alcance/área.
