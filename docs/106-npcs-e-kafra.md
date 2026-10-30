# NPCs visíveis e Kafra no mapa

Status: **rail de NPCs + Kafra interativa**.
Data: 30/10/2026.

## 1. Problema

A Kafra existia apenas como botão de portal. Não havia NPC visível no mapa.

## 2. Solução entregue

Rail **Moradores de Prontera** no canto inferior esquerdo:

- Kafra — save/teleporte;
- Comerciante — comércio (próxima etapa);
- Guia de Prontera — informação.

Cada card tem retrato, nome e ação. Clicar em Kafra abre o painel Kafra.

## 3. Kafra

- salvar ponto;
- teleportar ao save;
- recuperar HP/SP;
- API com token Ragnarok autoritativo.

## 4. Tentativa 3D

Foram adicionados atores `npc:kafra`, `npc:shop`, `npc:guide` em Prontera, com
sprites da API do viewer. As imagens são requisitadas, mas o sprite 3D ainda não
aparece corretamente no enquadramento da câmera.

O rail e os **pins no mapa** garantem a interação enquanto a ancoragem 3D é corrigida.

## 5. Teste

- rail visível;
- “Kafra” abre painel;
- “Ponto de save registrado.”;
- screenshot `frontend/test-results/npc-rail.png` e `kafra-panel.png`.

## 6. Limites

- NPC 3D não confiável ainda;
- comerciante sem loja;
- guia só mensagem;
- sem armazém;
- sem proximidade física.

## 7. Próximo

1. corrigir ator 3D de NPC;
2. loja do comerciante;
3. armazém Kafra;
4. portais.
