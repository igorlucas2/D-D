# Mapas, visual e itens: o que já é possível

Status: **visual por personagem implementado**; mapas 3D completos via viewer.
Última atualização: 28/10/2026.

## 1. Ligar todos os mapas

### O que está ligado na mesa

- **23 mapas táticos** no VTT:
  - mapa-múndi;
  - 14 mapas de cidade/dungeon;
  - 8 mapas de campo.
- **138 pontos de interação**.
- **22 texturas 3D** capturadas do `ragassets`.

### Todos os mapas do Ragnarok

O `ragassets` expõe **922 mapas**. O botão **3D navegável** abre o viewer
`latamvisuais`, cujo seletor interno lista todos os 922 — com terreno, modelos,
água e navegação.

Isso é diferente de ter **922 mapas táticos no VTT**:

- o pacote 3D completo tem ~5,8 GB;
- cada mapa precisaria de registro, pontos, portas e permissões;
- o viewer externo já resolve exploração/navegação.

**Resposta curta:** sim para **acessar todos pelo viewer 3D**; não para importar
todos como tabuleiro tático sem um trabalho grande de dados/assets.

## 2. Personagem visual por player

Nova aba **Visual** na ficha:

1. abrir o construtor do LATAM;
2. montar classe, cabelo, roupa e visuais;
3. copiar a URL do build (`?b=...`);
4. colar e salvar na ficha;
5. ver a prévia embutida.

O link fica em `Character.appearance`, que já existia no schema. A prévia usa
iframe do mesmo domínio liberado na CSP.

Cada jogador edita a própria ficha; o visual não altera CA, PV, itens ou regras.

## 3. Itens

### O que já funciona

- catálogo SRD carregado em `/catalog/items`;
- inventário por personagem;
- adicionar/remover/quantidade;
- **Equipar/Desequipar** (`InventoryItem.equipped`);
- uso de consumíveis suportados pelo motor de itens.

### O que não está integrado

- catálogo completo de **itens do Ragnarok** (`/raw/items.json`) como itens
  mecânicos;
- slots de equipamento RO (topo/meio/baixo/capa/arma);
- efeitos de cartas, refino, bônus de set e stats do RO.

O construtor visual usa os **visuais/costumes** do LATAM, mas eles são aparência,
não equipamento mecânico.

**Resposta curta:** dá para usar/equipar o catálogo atual; para “todos os itens
do Ragnarok” com efeito mecânico seria outro sistema de regras.

## 4. Próximos passos possíveis

1. **Catálogo de mapas**: importar nomes/thumbnails dos 922 e abrir cada um no
   viewer 3D, sem criar VTT tático.
2. **Itens RO visuais**: importar `/raw/items.json` apenas como catálogo de
   aparência, com ícones do ragassets.
3. **Equipamento RO mecânico**: modelar slots, bônus e efeitos — só faz sentido
   se a mesa migrar de SRD 5e para regras de Ragnarok.
4. **Retrato automático**: gerar um PNG do build via ragassets e salvar em
   `portraitUrl`.

## 5. Validação

- aba Visual visível na ficha;
- builder abre em nova aba;
- link validado contra `visuais.latam-tools.com.br`;
- prévia em iframe;
- `PATCH /characters/:id` com `appearance`;
- screenshot: `frontend/test-results/visual-tab.png`.
