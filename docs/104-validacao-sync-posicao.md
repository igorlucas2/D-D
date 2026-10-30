# Validação do sync de posição

Status: **limite de distância e caminho no sync**.
Data: 30/10/2026.

## 1. Regra

No `PUT /tokens/me`:

- posição continua limitada ao mapa;
- token existente:
  - distância máxima de **10 células** por sincronismo;
  - caminho precisa existir segundo `canReach`;
  - parede ou porta fechada bloqueia.

- primeiro sync cria o token na posição atual.

## 2. Teste

Token Ragnarok:

- criação em 10,10;
- sync para 12,11 → 200;
- sync de 0,0 para 19,15 → **400**
  `Movimento rápido demais para um único sincronismo.`;
- token removido.

## 3. Limites

- o limite de 10 células ainda é generoso e não usa velocidade real;
- portais/teleportes ainda precisam de exceção;
- o cliente ainda decide a posição dentro do limite;
- caminho é ortogonal, sem curva fechada por segundo.

## 4. Próximo

1. portal com transição autoritativa;
2. NPC/loja/Kafra;
3. combate Ragnarok usando o token;
4. roster do mestre.
