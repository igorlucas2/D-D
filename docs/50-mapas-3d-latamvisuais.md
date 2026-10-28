# Mapas 3D — captura via latamvisuais/ragassets

Status: **22 mapas com textura 3D**.
Última atualização: 28/10/2026.

## 1. Pipeline

1. Clone local de [`adsonpleal/latamvisuais`](https://github.com/adsonpleal/latamvisuais), commit `89c02f8e13ac535f215d95291f214a73e7c505d4`, licença MIT.
2. Viewer Vite local (`localhost:5173`) apontando para o servidor público do `ragassets`:
   `https://assets.latam-tools.com.br/maps/`.
3. Para cada mapa:
   - abrir `#play/<mapa>`;
   - aguardar o `__sim`;
   - esconder o personagem (`__sim.character.setVisible(false)`);
   - abrir a câmera (`__sim.engine.cam.zoom(1200)`);
   - remover a névoa (`__sim.engine.scene.fog = null`);
   - esconder a UI e capturar só o `<canvas>`.
4. Screenshot 1440×900, recortado para o aspect ratio do mapa e salvo em **JPEG q86**.
5. Textura gravada no `CampaignLoreMap`; `VttMap.imageUrl` com `?v=3d1`.

## 2. Mapas capturados

- Prontera, Izlude, Alberta, Geffen, Payon, Morroc;
- Al De Baran, Comodo, Juno, Umbala, Niflheim;
- Glast Heim, Torre do Relógio, Caverna de Payon;
- Campos de Prontera, Floresta de Payon, Deserto de Morroc, Pântano de Comodo;
- Campos de Geffen, Minas de Glast Heim, Estrada de Juno, Passo de Moscóvia.

O **mapa continental** continua sendo a representação esquemática; o `ragassets`
não expõe um mundo contínuo, apenas mapas individuais.

## 3. Imagens

- diretório: `backend/content/midgard-ecos/third-party/latamvisuais-3d/`;
- 22 JPEGs, ~7,1 MB;
- `LICENSE` do latamvisuais;
- `SOURCE.txt` com commit, servidor de assets e método de captura.

## 4. MIME

O endpoint de imagem antes devolvia sempre `image/png`. Agora detecta a assinatura:

- PNG `89 50 4E 47`;
- JPEG `FF D8 FF`;
- WebP `RIFF`.

Assim o VTT consegue exibir as texturas JPEG sem depender de conversão.

Também foi corrigido o carregador autenticado do frontend: ele exigia a URL
terminando em `/image`, e a query `?v=3d1` quebrava o match. Agora aceita
`/image?…`.

## 5. Resultado visual

- Prontera mostra a praça, o fontanário, telhados e sombras em alta resolução;
- Morroc mostra a cidade versionada em 3D com muralhas e ruas;
- os mapas de campo mostram terreno, árvores e construções reais;
- a grade do VTT continua por cima, como camada tática.

## 6. Licença e limites

- Código do viewer: MIT (`latamvisuais`);
- assets do mapa: `ragassets`, extraídos de cliente Ragnarok;
- arte original: © Gravity Interactive;
- screenshots são derivados para esta mesa pessoal/fan, não assets oficiais;
- o personagem foi escondido, mas **objetos do mapa** (estátuas, postes, construções) permanecem;
- a câmera é uma vista 3D isométrica, não um top-down ortográfico; hotspots antigos podem não alinhar perfeitamente.

## 7. Validação

- endpoint retornando `image/jpeg` para Prontera/Morroc/Campos de Prontera;
- textura 3D visível no VTT;
- screenshot: `frontend/test-results/midgard-3d-ui-final.png`;
- fonte crua: `frontend/test-results/latam3d/`.
