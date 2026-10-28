# Mapa-múndi, pins e três modos de mapa

Status: **implementado**.
Última atualização: 28/10/2026.

## 1. Mapa-múndi com pins

Novo botão **Mapa-múndi** na barra da Mesa. Ele abre um modal grande com:

- imagem do mapa continental;
- **pan e zoom** pelo `MapStage`;
- pinos de todas as cidades/entradas;
- pino dourado na cidade onde a cena atual está;
- iniciais dos personagens da companhia ao redor do pino da cena;
- legenda de cidade/companhia;
- cena atual no rodapé.

O pin de personagem usa o estado da Mesa (`scene.name`) e o hotspot da cidade
correspondente. Todos os personagens da cena recebem um pequeno deslocamento
para não empilhar.

## 2. Modos de textura

No palco, abaixo das abas de mapa:

| Modo | O que faz |
| --- | --- |
| **2D** | planta tática/minimap com grade |
| **Foto 3D** | render 3D isométrico estático |
| **3D navegável** | abre o simulador 3D externo em iframe |

O modo 2D usa a rota autenticada:

`GET /campaigns/:id/lore/maps/:mapId/image?mode=2d`

O backend lê a planta 2D de
`backend/content/midgard-ecos/third-party/classic-world-map-ragnarok/framed/`.
O modo 3D devolve a textura JPEG padrão.

## 3. 3D navegável

Abre um modal com:

`https://visuais.latam-tools.com.br/#play/<mapa>`

Isso permite arrastar, girar, dar zoom e caminhar pelo mapa real. O mapeamento
de nome da mesa para slug do ragassets está em `LIVE_MAP_SLUG`.

A CSP do Next foi ajustada:

```text
frame-src 'self' https://visuais.latam-tools.com.br
```

Sem isso o navegador bloqueava o iframe.

## 4. MIME e cache

- endpoint detecta PNG/JPEG/WebP;
- modos usam query `mode=2d`/`mode=3d`;
- o carregador autenticado aceita `/image?…`;
- o VTT invalida cache ao trocar de modo.

## 5. Validação

- **Mapa-múndi**: modal 1.440 px, cidades e legenda visíveis, zoom/pan ativos.
- **2D**: minimap de Prontera com grade.
- **Foto 3D**: render isométrico de Prontera.
- **3D navegável**: iframe carregou `visuais.latam-tools.com.br/#play/prontera`
  e exibiu o mapa 3D jogável.
- Screenshots:
  - `frontend/test-results/midgard-world-map.png`
  - `frontend/test-results/midgard-mode-2d.png`
  - `frontend/test-results/midgard-mode-photo.png`
  - `frontend/test-results/midgard-live-fixed.png`

## 6. Limites

- O 3D navegável é um app externo em iframe; tem UI e personagem próprios,
  não compartilha tokens/combate do VTT.
- Precisa de internet para carregar o viewer e os assets do ragassets.
- O mapa-múndi usa a representação esquemática; os pinos são aproximados.
- O pino da companhia usa a cena do grupo, não a posição individual de cada
  personagem em mapas diferentes.
- O modo 2D depende do arquivo local da planta; se o arquivo faltar, cai na
  textura 3D.
