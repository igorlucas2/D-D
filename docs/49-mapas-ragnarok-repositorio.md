# Mapas reais do Ragnarok — repositório e licença

Status: **texturas aplicadas na mesa**.
Última atualização: 28/10/2026.

## 1. Repositório usado

[`brahmamstr/classic-world-map-ragnarok`](https://github.com/brahmamstr/classic-world-map-ragnarok)

- Licença: **MIT**;
- commit fixado: `78aa4bb39246f4d79e4012224144ed21cfa26cbd`;
- conteúdo usado: minimaps reais de cidades, campos e dungeons;
- cópia local:
  - `backend/content/midgard-ecos/third-party/classic-world-map-ragnarok/images/`
  - `LICENSE` e `SOURCE.txt` no mesmo diretório.

### Por que não usei o `ragassets`

O [`adsonpleal/ragassets`](https://github.com/adsonpleal/ragassets) é excelente,
mas fornece **geometria 3D** (`.gat`/`.gnd`/`.rsw`, modelos e texturas) extraída
de um cliente local — cerca de 5,8 GB e 922 mapas. Não entrega PNG plano pronto
e exige que o usuário tenha o cliente/GRF do Ragnarok. Para esta mesa, o
repositório de minimaps MIT resolve o VTT 2D imediatamente.

O [`Ragnarok Offline Pre-Renewal Pack`](https://ragnarokoffline.github.io/)
também foi considerado, mas é um cliente/servidor completo de ~6 GB, não um
pacote de imagens de mapa.

## 2. O que foi aplicado

- **22 mapas** receberam textura real:
  - cidades: Prontera, Izlude, Alberta, Geffen, Payon, Morroc, Al De Baran,
    Comodo, Juno, Umbala, Niflheim, Glast Heim;
  - dungeons: Torre do Relógio, Caverna de Payon, Minas de Glast Heim;
  - campos: Campos de Prontera, Floresta de Payon, Deserto de Morroc,
    Pântano de Comodo, Campos de Geffen, Estrada de Juno, Passo de Moscóvia.
- O **mapa continental** continua sendo a representação esquemática original,
  porque o repositório não tem um mapa-múndi grande.
- As texturas antigas continuam no pacote base `midgard-ecos` 1.0.0; a mesa atual
  usa a versão com os minimaps reais.

## 3. Mapa de origem

| Mapa da mesa | Arquivo do repositório |
| --- | --- |
| Prontera | `prontera-min.png` |
| Izlude | `izlude-min.png` |
| Alberta | `alberta-min.png` |
| Geffen | `geffen-min.png` |
| Payon | `payon-min.png` |
| Morroc | `morocc-min.png` |
| Al De Baran | `aldebaran-min.png` |
| Comodo | `comodo-min.png` |
| Juno | `yuno-min.png` |
| Umbala | `umbala-min.png` |
| Niflheim | `niflheim-min.png` |
| Glast Heim | `glast_01-min.png` |
| Torre do Relógio | `c_tower1.png` |
| Caverna de Payon | `pay_dun00.png` |
| Campos de Prontera | `prt_fild01-min.png` |
| Floresta de Payon | `pay_fild01-min.png` |
| Deserto de Morroc | `moc_fild01-min.png` |
| Pântano de Comodo | `cmd_fild01-min.png` |
| Campos de Geffen | `gef_fild01-min.png` |
| Minas de Glast Heim | `gl_dun01.png` |
| Estrada de Juno | `yuno_fild01-min.png` |
| Passo de Moscóvia | `xmas-min.png` |

## 4. Tratamento das imagens

Os minimaps de cidade/field têm **56×56 px** na origem. Para o VTT:

1. foram ampliados com **nearest neighbor** (preserva o desenho pixelado);
2. receberam moldura de pergaminho e borda;
3. foram gerados no aspect ratio do mapa;
4. a textura foi gravada no `CampaignLoreMap` e o `imageUrl` recebeu `?v=ro1`
   para invalidar cache.

As imagens finais estão em:

`backend/content/midgard-ecos/third-party/classic-world-map-ragnarok/framed/`

## 5. Licença e atribuição

O repositório é MIT. O arquivo `LICENSE` está copiado junto das imagens.

**Aviso:** os minimaps derivam da arte do Ragnarok Online, cujos direitos
pertencem à Gravity/Gungho. A licença MIT cobre o repositório comunitário, não
necessariamente a arte original. Use esta mesa como material pessoal/fan e não
redistribua os assets como se fossem oficiais.

Atribuição:

> Minimaps: `brahmamstr/classic-world-map-ragnarok`, MIT, commit
> `78aa4bb39246f4d79e4012224144ed21cfa26cbd`.

## 6. Limites

- Cidades e fields são minimaps de 56×56; a ampliação não cria detalhe novo.
- O mapa-múndi é esquemático.
- A posição dos hotspots foi mantida da representação anterior e pode não
  coincidir pixel a pixel com o minimap.
- Para mapas 3D bonitos e em alta resolução, o próximo passo é o `ragassets`
  com cliente/GRF local, renderizando os mapas fora do VTT.

## 7. Validação

- 22 texturas aplicadas no MySQL;
- endpoint de imagem servindo PNG;
- mapa **Prontera** abriu no VTT após a troca;
- screenshot: `frontend/test-results/midgard-ro-prontera.png`.
