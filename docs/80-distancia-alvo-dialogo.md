# Distância do alvo no diálogo

Status: **distância em pés nos alvos de ataque e magia**.
Última atualização: 28/10/2026.

## 1. Fonte

`ActionTarget.distanceFeet` é preenchido pela HUD imersiva:

- posição do participante atual;
- posição do alvo;
- Chebyshev × 5.

## 2. Exibição

Ataque:

```text
Poring (12/12) · 10 pés
```

Magia:

```text
Poring · 10 pés
```

## 3. Limites

- `null` quando falta coordenada;
- não bloqueia alvo no diálogo; o servidor valida o alcance;
- magia ainda não tem alcance numérico;
- sem cobertura.

## 4. Próxima fase

- marcar alvos fora de alcance em vermelho;
- cobertura/linha de visão;
- munição;
- área de magia.
