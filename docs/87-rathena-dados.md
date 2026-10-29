# rAthena como fonte de dados (não de assets)

Status: **pesquisa**.
Data: 28/10/2026.
Repositório: https://github.com/rathena/rathena

## 1. O que é

rAthena é o **emulador de servidor** do Ragnarok Online, escrito em C++.
Ele não é o cliente gráfico e não distribui os assets do jogo.

## 2. O que existe no repositório

Verificação da árvore `master`:

- 5.197 entradas;
- licença **GPL-3.0**;
- **0** arquivos `.grf`, `.gat`, `.rsw`, `.gnd`, `.spr`, `.act`, `.glb`
  ou `.gltf`;
- nenhum mapa, sprite, textura ou modelo 3D.

O que ele tem de valioso:

| Caminho | Conteúdo |
| --- | --- |
| `db/map_index.txt` | nomes/IDs dos mapas |
| `npc/kafras/` | 4 scripts de Kafra |
| `npc/merchants/` | 26 scripts de lojas |
| `npc/warps/` | 85 scripts de warps/portais |
| `npc/mobs/` | 3 scripts de spawns |
| `db/` | itens, monstros, skills, classes |
| `npc/` | scripts de NPCs e serviços |

O script de Kafra já documenta:

- mensagem;
- teleporte;
- armazém;
- **aluguel de carrinho** (`Rent a Pushcart`);
- save.

Isso cobre exatamente Kafra + carrinho + lojas + portais na camada de dados.

## 3. O que falta

Para renderizar o mapa atual, o viewer precisa de:

- `manifest.json` do mapa;
- `.gat` (colisão/altura);
- `.rsw` (objetos/efeitos);
- texturas;
- sprites/modelos.

Nada disso está no rAthena. Vem do **cliente/GRF** do Ragnarok, que é
proprietário da Gravity.

Também não há GLB de personagem ou item no rAthena.

## 4. Como usar sem trocar o Ragnarok

### Camada de dados — pode começar já

Importar do rAthena para o nosso banco:

- `map_index` → catálogo de mapas;
- `npc/kafras` → Kafra, teleporte, armazém, save, carrinho;
- `npc/merchants` → lojas e estoque;
- `npc/warps` → portais e destinos;
- `npc/mobs` → spawns;
- `db` → itens/mobs/skills quando necessário.

Isso preserva a lógica Ragnarok sem tocar no visual.

### Camada visual — depende do cliente

Precisa de uma destas fontes:

1. `data.grf` / `rdata.grf` de um cliente que você tenha;
2. backup/mirror dos assets que o viewer usava;
3. cache local de uma máquina onde o mapa ainda abre.

Com o GRF, o extrator do ragassets (`extract-grf.mjs --maps`) gera os
manifestos e texturas; depois servimos em `/assets/ragnarok/maps/` e
apontamos o viewer para same-origin.

### Licença

- rAthena é GPL-3.0; scripts/dados importados exigem atenção de licença;
- assets do cliente Ragnarok são proprietários;
- não redistribuir GRF/sprites sem licença;
- GLB “Ragnarok” só com asset original/licenciado.

## 5. Próximo passo recomendado

Sem mexer no visual:

1. importar `map_index` para o catálogo;
2. importar Kafra/lojas/warps/mobs do rAthena;
3. usar esses dados para o console do mestre e para os portais;
4. manter o viewer e os assets Ragnarok intocados.

Para voltar a renderizar Prontera:

1. obter o GRF/cliente ou o mirror dos assets;
2. extrair para o nosso storage;
3. ajustar `VITE_MAPS_URL` para same-origin;
4. validar Prontera + Kafra + portal.

Sem o passo 1, o mapa 3D continua sem geometria.

## 8. ROenglishRE (llchrisll/ROenglishRE)

O repositório é um projeto de **tradução/recursos**, não um cliente completo.

Árvore `master`:

- 1.901 entradas;
- 226 MB;
- 59 `.rsw`;
- 34 `.gat`;
- 33 `.gnd`;
- 1.030 `.bmp`;
- 221 `.lub`;
- 122 `.txt`;
- **0** `.rsm`, `.spr`, `.act`, `.pal`, `.str`, `.glb`.

### O que ele tem de útil

Inclui geometria de mapas, inclusive:

```text
Translation/Pre-Renewal/data/prontera.gat
Translation/Pre-Renewal/data/prontera.gnd
Translation/Pre-Renewal/data/prontera.rsw
```

E mapas de campos/cidades:

- `prt_fild00` … `prt_fild10`;
- `moc_fild01`;
- `pay_fild04`;
- `aldebaran`, `payon`, `yuno`, `lighthalzen`, `einbroch`;
- versões Pre-Renewal e Renewal para alguns.

Também tem texturas de mapa em
`Additions/data/texture/.../map/` e dados de tradução.

### O que falta

- `.rsm` — modelos 3D dos objetos/casas;
- `.spr/.act` — NPCs, personagens e efeitos;
- `.pal` — paletas;
- áudio;
- catálogo completo de mapas.

Ou seja: dá para extrair **terreno e texturas de Prontera**, mas não as casas,
NPCs e sprites que o viewer desenha por cima.

### GRFs do projeto

A documentação do projeto aponta `official_data.grf` e `kro_data.grf` no
MediaFire/Google Drive. São recursos oficiais compilados por fãs
(sprites/texturas ausentes no `data.grf`), não uma licença da Gravity.

Servem para complementar, mas:

- são grandes;
- a licença continua proprietária;
- não substituem o cliente completo;
- não garantem os `.rsm` que faltam.

### Conclusão

ROenglishRE é útil para:

1. obter a geometria de Prontera e campos;
2. obter texturas de mapa;
3. comparar Pre-Renewal/Renewal;
4. montar um manifesto local de teste.

Não é suficiente sozinho para restaurar o viewer completo.

Para o mapa voltar como era, o conjunto mínimo é:

```text
.gat + .gnd + .rsw
+ .rsm dos objetos
+ texturas
+ .spr/.act dos NPCs
+ manifest
```

## 9. `official_data.grf` analisado

Arquivo: `official_data.grf` (782.906.013 bytes), adicionado na raiz.

Leitura com `@chicowall/grf-loader`:

- **163.421 arquivos**;
- encoding detectado: **CP949**;
- 82.955 `.spr`;
- 65.230 `.act`;
- 11.601 `.bmp`;
- 2.309 `.tga`;
- 541 `.str`;
- 343 `.png`;
- 321 `.gif`;
- 6 `.txt`;
- 1 `.wav`.

### O que ele NÃO tem

- **0** `.rsw`;
- **0** `.gat`;
- **0** `.gnd`;
- **0** `.rsm`;
- **0** `.pal`;
- **0** `.lub`.

Ou seja:

- **não tem mapa**;
- **não tem modelos 3D de casas/objetos**;
- **não tem áudio de mapa**;
- é um GRF **aditivo** de recursos que não estavam no `data.grf` básico.

### O que ele cobre

- sprites de personagens, NPCs e monstros;
- animações `.act`;
- texturas de efeitos e interface;
- efeitos `.str`;
- alguns ícones/ilustrações.

Exemplos encontrados:

```text
data\sprite\인간족\...
data\sprite\몬스터\...
data\sprite\npc\...
data\texture\effect\...
```

`kafra` aparece apenas como **ilustração de interface**, não como sprite de
NPC base. `cart` aparece só em efeitos de carrinho. Isso confirma que ele é
complementar, não o cliente base.

### Conclusão

`official_data.grf`:

- ✅ ajuda com NPCs, monstros, sprites e efeitos;
- ❌ não cobre mapas;
- ❌ não cobre `.rsm`;
- ❌ não substitui `data.grf`/`rdata.grf`.

Para Prontera ainda faltam:

```text
mapa: .gat + .gnd + .rsw
objetos: .rsm
base: sprites que não estão neste GRF aditivo
```

## 10. `rAthenaCN/ROClientFullCN` analisado

Repositório: https://github.com/rAthenaCN/ROClientFullCN

É um **cliente completo dividido em GRFs**, com Git LFS:

| Arquivo | Tamanho |
| --- | ---: |
| `map.grf` | 841.151.442 |
| `sprite.grf` | 808.880.982 |
| `texture_01.grf` | 849.898.478 |
| `texture_02.grf` | 1.143.958.835 |
| `luafiles.grf` | 270.163.516 |
| `data.grf` | 769 (stub) |

### `map.grf`

- 3.321 arquivos;
- **1.095 `.rsw`**;
- **1.096 `.gat`**;
- **1.074 `.gnd`**;
- **0 `.rsm`**.

Prontera está presente:

```text
data\prontera.gat
data\prontera.gnd
data\prontera.rsw
data\prt_fild01.*
data\prt_in.*
```

O `prontera.rsw` referencia **14 `.rsm`**, por exemplo:

```text
01-1.rsm
01-2.rsm
event\prop_s_01.rsm
```

Esses modelos não estão no `map.grf`.

### `sprite.grf`

- 60.710 `.spr`;
- 66.849 `.act`;
- **0 `.rsm`**.

Kafra está coberta:

```text
data\sprite\npc\4_f_kafra1.spr/.act
...
data\sprite\npc\4_f_kafra9.spr/.act
data\sprite\npc\4_f_agentkafra.spr/.act
```

Também há classes com carrinho (`cart_summoner_*`).

### `texture_01.grf` e `texture_02.grf`

- 27.436 + 23.172 `.bmp`;
- 172 + 7.318 `.tga`;
- Prontera:
  - `data\texture\prontera\prt_bot*.bmp`;
  - `data\texture\prontera\prt_city_bot*.bmp`;
  - `data\texture\prontera\pd_bot*.bmp`.

**0 `.rsm`** em ambos.

### `data.grf`

É um **stub**: 769 bytes, contém apenas `data\sclientinfo.xml`.
Não tem os modelos base.

### GPF interno

`map.grf` tem `data\2012-12-7bdata.gpf` (4.858 MB), versão `0x102`.
O `grf-loader` não abre essa versão. Pode conter patch de dados, mas não
foi validado.

### Veredito

O `ROClientFullCN` cobre:

- ✅ 1.095 mapas (terreno `.gat/.gnd/.rsw`);
- ✅ Prontera e `prt_fild01`;
- ✅ Kafra e sprites de NPCs;
- ✅ texturas de Prontera;
- ❌ modelos `.rsm` de casas/objetos;
- ❌ `data.grf` base.

Portanto:

- dá para restaurar **terreno, texturas e NPCs**;
- ainda faltam os **modelos 3D** que o `prontera.rsw` referencia;
- sem `.rsm`, a cidade fica sem construções/fonte/objetos.

Próximo passo: obter um `data.grf`/model GRF com os `.rsm` (ou o GPF correto)
e combiná-lo com `map.grf + sprite.grf + texture_*.grf`.

## 11. Busca por repositórios com os dois arquivos que faltam

Objetivo: achar um repo público que forneça **`data.grf` completo** e/ou
**`.rsm` de Prontera**.

| Repositório | O que tem | O que falta |
| --- | --- | --- |
| `rAthenaCN/ROClientFullCN` | 1.095 mapas, Kafra, texturas | `.rsm`, `data.grf` real |
| `llchrisll/ROenglishRE` | Prontera `.gat/.gnd/.rsw`, texturas | `.rsm`, `.spr/.act` |
| `Spell-Master/modificar-data-ragnarok` | 140 mapas, 5 spr/act | `.rsm`, cliente base |
| `Pluc15/ragnarok-pluc-grf` | 853 mapas, 10 `.rsm` (traps), texturas | `.rsm` de Prontera |
| `ddexx2/grfRagnarok` | 8 GRFs customizados (~222 MB) | cliente base; não validado |
| `Casual-Ragnarok/ro-single-client` | patch de cliente + sprites | mapas, `.rsm`; exige KRO 2019 |
| `arkadeleon/ragnarok-offline` | app offline | assets baixados externamente |
| `tiagofm94/RO-Clientresources` | sprites, `.pal` | mapas, `.rsm` |
| `Kelberwitz/RO_Undiff-Client` | executáveis/Ragexe | assets |
| `hiphop9/ROClient_en` | executáveis | assets |
| `Vitzsukon/Ragnarok_data_grf` | GRFs pequenos/custom | cliente completo |

### Conclusão da busca

Nenhum repositório público validado contém **os dois completos**:

- `ROClientFullCN` é o mais próximo, mas tem `data.grf` stub e nenhum `.rsm`;
- `ROenglishRE` cobre a geometria de Prontera, mas não os modelos;
- `Pluc15` tem 10 `.rsm`, mas são traps, não a cidade;
- os demais são custom patches, executáveis ou exigem um cliente KRO externo.

O que falta de verdade é o **cliente base KRO** (ou um `data.grf`/model GRF
equivalente) com `data\model\prontera\*.rsm`.

Alternativas legítimas:

1. instalar um cliente KRO oficial e extrair os `.rsm` para uso local;
2. achar um mirror autorizado do `data.grf`;
3. criar modelos originais no estilo Ragnarok (não usar asset genérico).

Sem uma dessas fontes, o `ROClientFullCN` renderiza terreno, texturas e NPCs,
mas não as construções de Prontera.




