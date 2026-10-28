# Alvos fora de alcance no diálogo

Status: **marcação e bloqueio local por alcance**.
Última atualização: 28/10/2026.

## 1. Diálogo de ataque

Cada alvo mostra:

```text
Poring (12/12) · 10 pés
Poring (12/12) · 30 pés · fora de alcance
```

O botão **Atacar** fica desabilitado quando o alvo está fora do alcance da arma
selecionada.

## 2. Cálculo

- `weaponRangeFeet(item)` usa a mesma tabela do servidor;
- `target.distanceFeet` vem da HUD;
- se `distanceFeet > rangeFeet`, alvo inválido.

## 3. Limites

- magia ainda sem esse bloqueio;
- sem cobertura/linha de visão;
- alvo sem distância (`null`) continua permitido;
- o servidor permanece autoritativo.

## 4. Próxima fase

- alcance de magia;
- cobertura;
- munição;
- destaque 3D de alvo inválido.
