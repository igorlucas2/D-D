# Cliente completo e assets locais de Prontera

Status: **Prontera 3D restaurada a partir do cliente local**.
Data: 29/10/2026.

## 1. ZIP validado

`ROTrainingGrounds_02_05_2025.zip` (4,9 GB):

- `data.grf` — 2.876.419.709 bytes;
- `rdata.grf` — 289.592.232 bytes;
- `official_data.grf` — 1.023.508.651 bytes;
- `roenglish.grf` — 27.265.709 bytes;
- `rotg.grf` — 61.547.678 bytes;
- BGM, executáveis e DLLs.

O `data.grf` contém:

- 171.708 arquivos;
- 988 `.rsw`, 988 `.gat`, 987 `.gnd`;
- **7.048 `.rsm`**;
- 39.505 `.spr`, 54.845 `.act`;
- 46.583 `.bmp`, 7.565 `.tga`;
- 3.676 `.pal`;
- 3.103 `.wav`.

Prontera:

```text
data\prontera.gat
data\prontera.gnd
data\prontera.rsw
data\model\프론테라\...
data\model\prontera\...
data\model\prontera_re\...
data\texture\prontera\...
```

Kafra:

```text
data\sprite\npc\4_f_kafra1..9.spr/.act
```

## 2. Extração

O `data.grf` usa compressão não suportada pelo `grf-loader`, mas o
`zextractor` lê:

```powershell
zextractor --grf=data.grf --filtersfile=filters.txt --outdir=tree
```

Depois o extrator do ragassets gera o manifesto a partir da árvore:

```powershell
node extract-grf.mjs --maps resources/maps --grf tree --map prontera
```

Resultado:

```text
✓ prontera: 63/63 models, 218/218 textures, water 0 (32/32), 152 effects
```

## 3. Onde está

Cópia local (ignorada pelo Git):

```text
frontend/public/ragassets/maps/
  index.json
  prontera/
  _m/  (63 modelos)
  _t/  (218 texturas)
  _u/  (UI)
  _w/  (32 frames de água)

frontend/public/ragassets/bgm/
  index.json
  prontera.mp3
```

O viewer built foi apontado para:

```text
/ragassets/maps/
/ragassets/bgm/
```

O visual, os sprites e o viewer são os mesmos; mudou só a origem dos assets.

## 4. Evidência

- `frontend/test-results/local-prontera.png` — viewer direto;
- `frontend/test-results/local-prontera-bgm.png` — BGM 206;
- Prontera renderizada com fonte, prédios, flores, grade e personagem;
- BGM `/ragassets/bgm/prontera.mp3` responde 206.

## 5. Licença

O README do `ROClientFullCN` diz que os assets pertencem à Gravity e são
para estudo. O ZIP é local; `*.grf` e `frontend/public/ragassets/` estão no
`.gitignore`. Não redistribuir.

## 6. Próximo passo

- extrair as demais cidades/campos usados pela campanha;
- manter `index.json` com os mapas disponíveis;
- ligar portais e NPCs ao dataset rAthena;
- trocar a URL do viewer no build (não no JS compilado) quando o pipeline
  de assets for fechado.
