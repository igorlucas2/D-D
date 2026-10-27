# Mapas do Pacto dos Três Sinos

Mapas esquemáticos originais preparados para esta lore em 16/10/2026. Geografia, desenho e composição foram criados para o projeto; não há imagem copiada de livro, marketplace, franquia ou serviço de mapas. Os desenhos não incorporam fichas ou textos SRD. A atribuição das fichas reutilizadas é tratada separadamente na [spec](../../13-mestre-ia-lore.md).

| Mapa | Fonte editável | Textura | Grade |
| --- | --- | --- | --- |
| Vale do Lume | [SVG](./vale-do-lume.svg) | [PNG](./vale-do-lume.png) | 30 × 20; 1500 × 1000 px |
| Porto das Cinzas | [SVG](./porto-das-cinzas.svg) | [PNG](./porto-das-cinzas.png) | 24 × 18; 1200 × 900 px |
| Abadia do Terceiro Sino | [SVG](./abadia-do-terceiro-sino.svg) | [PNG](./abadia-do-terceiro-sino.png) | 24 × 18; 1200 × 900 px |

Cada célula ocupa 50 × 50 px, sem margem externa. Coordenadas do [atlas](../atlas.json) começam no canto superior esquerdo: centro do ponto `(x, y)` = `((x + 0.5) * 50, (y + 0.5) * 50)` pixels. Norte para cima. Os trajetos regionais têm o tempo indicado no atlas; a distância desenhada não substitui esse custo. Os números dos pontos são apenas uma legenda visual, não IDs do banco.

O [gerador](./gerar-mapas.py) usa somente a biblioteca padrão do Python e lê o atlas; execute `python docs/lore/mapas/gerar-mapas.py` a partir da raiz para reconstruir os SVGs. Os PNGs são rasterizações em Chromium, na resolução nativa, sem margens. Depois de alterar um SVG, rasterize novamente e confira o alinhamento. O gerador não altera o banco nem instala conteúdo em campanhas.

Região e vila podem ser apresentadas desde a abertura. A planta da abadia é entregue quando descoberta: sua arquitetura é conhecida e não contém salas secretas. O que os habitantes sabem, pistas, encontros, objetos móveis e segredos não estão gravados nas imagens. Desenhos de portas e paredes são referências visuais; bloqueio, visão, portas interativas, fog e hotspots precisam de dados próprios na fase MI-02. A disposição visual das passagens deve orientar esses dados, sem inferir colisão automaticamente pelos pixels.

Para futura importação, o backend deve copiar/servir as texturas por uma URL compatível com 2D e 3D e aplicar o controle de acesso definido na spec. Caminhos de documentação não são URLs de runtime. O atlas ainda é material de especificação, não payload aceito pelas APIs atuais.
