# Editor de resistências na ficha — Fase U

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Objetivo

Permitir editar `CharacterResistance` direto na ficha, sem SQL:

- adicionar resistência/imunidade/vulnerabilidade;
- remover;
- substituir o conjunto inteiro de forma atômica;
- refletir imediatamente no motor de dano.

## 2. API

### `PUT /characters/:id/resistances`

```ts
{
  resistances: Array<{
    damageType: string;
    type: "RESISTANCE" | "IMMUNITY" | "VULNERABILITY";
  }>;
}
```

- exige o dono da ficha;
- apaga as resistências antigas e grava o novo conjunto na mesma transação;
- deduplica por `type + damageType`;
- devolve a ficha atualizada, incluindo `resistances`.

A rota eleva o OpenAPI para **118 rotas**.

## 3. UI

Na aba **Atributos** da ficha:

- lista de resistências com botão de remover;
- campo de tipo de dano;
- seletor resistência/imunidade/vulnerabilidade;
- botão **Adicionar**;
- erro de API visível.

## 4. Teste real

- `PUT` com `fire / RESISTANCE`: **200**;
- ficha retorna a resistência criada;
- dano manual **11 fire** no personagem:
  - aplicado **5**;
  - `defense.type = RESISTANCE`;
- `PUT` com lista vazia remove;
- HP, encontro e ações de teste restaurados.

## 5. Limites

- A edição substitui o conjunto inteiro; não há endpoint incremental.
- Não há autocomplete de tipos de dano; texto livre é normalizado no cálculo.
- Resistências de **participantes/monstros** continuam no painel de combate,
  não na ficha.
- A narração automática ainda não menciona resistência.

## 6. Testes

- **211 testes / 39 suítes**;
- OpenAPI: **118 rotas**.
