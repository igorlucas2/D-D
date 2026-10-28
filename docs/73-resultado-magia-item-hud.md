# Resultado de magia e item na HUD

Status: **resolução visível no combate imersivo**.
Última atualização: 28/10/2026.

## 1. Magia

`submitSpellCast` agora captura `SpellCastResult` e mostra:

```text
Magia: Bola de Fogo → Poring 8 PV
```

- nome da magia;
- alvos;
- PV aplicados por alvo.

## 2. Item

`submitItemUse` captura `ItemUseResult`:

```text
Item: Poção de Cura → Thalion: 7 PV
```

- nome do item;
- alvo;
- PV aplicados.

## 3. Onde aparece

Na HUD de combate, abaixo do resultado do ataque e acima do Registro.

## 4. Limites

- não substitui o cartão completo de resolução da mesa narrada;
- magia ainda sem área/alcance 3D;
- item de dano usa o próprio personagem como alvo;
- resultados antigos não são empilhados.

## 5. Próxima fase

- cartão completo de resolução;
- área de magia no terreno;
- alvo por clique para magia;
- animação de conjuração/consumo.
