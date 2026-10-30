# Equipar e desequipar itens Ragnarok

Status: **interação de equipamento na ficha**.
Data: 30/10/2026.

## 1. UI

Na ficha:

- seção **Equipamento**;
- botão **Equipar** / **Desequipar** em itens com slot;
- seção **Inventário** com os mesmos itens, quantidade e ação;
- conflito de slot continua resolvido pelo servidor.

Itens sem slot (consumíveis) não mostram botão de equipar.

## 2. API

Usa o endpoint existente:

```http
PATCH /api/ragnarok/characters/:id/items/:entryId
{ "equipped": true }
```

O servidor:

- valida dono da ficha;
- valida item da ficha;
- desequipa outro item do mesmo slot;
- devolve a ficha atualizada.

## 3. Teste

- item `Flor` (headgear) entregue pelo mestre;
- slot `headgear`;
- `equipped: false → true`;
- ficha removida.

## 4. Limites

- equipamento ainda não altera sprite;
- não aplica bônus mecânicos;
- consumíveis ainda não podem ser usados;
- não há peso;
- não há loja/Kafra;
- quantidade de equipáveis é tratada como pilha, não como várias instâncias.

## 5. Próximo

1. consumir item;
2. aplicar bônus de equipamento;
3. composição no sprite;
4. loja/Kafra;
5. token/posição.
