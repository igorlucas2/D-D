# Modo imersivo — Fase 1

Status: **protótipo jogável**.
Última atualização: 28/10/2026.

## 1. Duas mesas

| Modo | Rota | Estado |
| --- | --- | --- |
| Mesa narrada | `/campaigns/:id` + `/play` | Mantida |
| Modo imersivo | `/campaigns/:id/immersive` | Novo |

O modo imersivo usa o **mesmo campanha, fichas, crônica e combate**. Ele não
duplica dados.

## 2. Viewer 3D local

O `latamvisuais` (MIT) foi compilado para `frontend/public/immersive/` e é
carregado no mesmo domínio. Isso permite controlar o viewer pelo parent:

```ts
frame.contentWindow.__eldoria.setActors(...)
frame.contentWindow.__eldoria.setLocked(true|false)
```

O CSS injetado esconde a UI do viewer e deixa só o canvas. A ponte expõe:

- `setActors`: NPCs/atores como sprites 3D;
- `setLocked`: bloqueia o movimento no combate;
- `isReady`: só aplica atores depois do mundo carregado.

CSP:

- `frame-src 'self' https://visuais.latam-tools.com.br`;
- `connect-src` e `media-src` liberam `assets.latam-tools.com.br`.

## 3. O que já funciona

- mapa 3D em tela cheia;
- movimento livre por click-to-move e câmera;
- troca de mapa no topo;
- Party, Crônica, Combate e NPCs na lateral;
- **NPCs ambiente** por cidade (Guarda, Pregoeiro, Cidadã, Pescador etc.);
- **mestre invoca NPCs** com nome, célula X/Y e sprite;
- **mestre move NPCs** alterando X/Y;
- NPCs invocados ficam salvos como tokens do VTT;
- combate ativo trava o movimento (`setLocked`);
- o combate em turnos continua no painel atual.

## 4. Como usar

1. abra a Mesa;
2. clique em **Modo imersivo**;
3. escolha o mapa no seletor;
4. arraste/clique no mapa para andar; use o botão direito para girar;
5. abra a aba **NPCs**;
6. como mestre, preencha nome/X/Y e clique **Invocar**;
7. abra **Combate** e inicie um encontro; o mapa trava para turnos.

## 5. Limites desta fase

- o avatar local ainda é o personagem padrão do viewer, não o build salvo na ficha;
- outros jogadores não aparecem como avatares 3D (só NPCs/tokens aparecem);
- o combate trava o mapa, mas o movimento tático/iniciativa ainda acontece no
  painel 2D, não em células 3D;
- NPCs ambiente são uma camada local por cidade; os persistentes são tokens;
- a arte dos sprites é do Ragnarok/Gravity (uso pessoal/fan);
- depende do servidor público de assets do ragassets.

## 6. Próxima fase

- renderizar o build de `Character.appearance` no avatar local;
- sincronizar posição dos personagens entre jogadores;
- combate 3D: iniciativa, movimento, alcance, ataques e IA;
- animações de ataque/morte e barras de vida no mundo.

## 7. Validação

- viewer carregado via `__eldoria`;
- atores pendentes aplicados após o mundo carregar;
- NPCs ambiente visíveis;
- mestre invocou e removeu NPC de teste;
- screenshots:
  - `frontend/test-results/immersive-final.png`
  - `frontend/test-results/immersive-token-list.png`.
