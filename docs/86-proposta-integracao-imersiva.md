# Correção — preservar o Ragnarok existente

Status: **correção de rota**.
Data: 28/10/2026.

## 1. O que não fazer

Não substituir o visual do Ragnarok por assets genéricos (KayKit, Quaternius,
Kenney etc.). O modo imersivo precisa manter:

- o viewer atual;
- os sprites e mapas do Ragnarok;
- a identidade visual já construída;
- o catálogo e as fichas Ragnarok.

Os packs genéricos baixados foram **removidos**; não estavam em uso.

## 2. O que realmente quebrou

A tela em branco é o viewer tentando buscar os mapas no host externo:

```http
GET https://assets.latam-tools.com.br/maps/index.json
→ 404 Not Found

GET https://assets.latam-tools.com.br/maps/prontera/manifest.json
→ 404 Not Found
```

O navegador mostra erro de CORS porque a resposta 404 não traz
`Access-Control-Allow-Origin`. O problema não é o novo console, a ficha nem o
personagem.

O host ainda serve BGM e efeitos, mas não os mapas.

Não há `*.rsw`, `*.gat`, `*.gnd` nem GLB de mapa no repositório. O 3D sempre
dependeu do host externo; sessões com cache continuam abrindo, sessões limpas
não.

## 3. Correção correta

**Espelhar exatamente os assets Ragnarok que já funcionavam**, não recriar com
outro estilo.

Opções, em ordem:

1. **Backup/mirror do host** `assets.latam-tools.com.br/maps/`;
2. **GRF/cliente Ragnarok licenciado** do próprio projeto, extraído para
   `manifest.json` + `.gat` + `.rsw` + texturas;
3. **Cache local** de uma máquina onde o viewer ainda abre;
4. Só depois, modelos GLB **no estilo Ragnarok**, se houver asset/licença.

O viewer atual continua o mesmo. A única mudança seria a URL base:

```text
VITE_MAPS_URL=/assets/ragnarok/maps/
```

Servido pelo nosso backend/CDN, com CORS e cache corretos.

## 4. O que precisa ser preservado

- `frontend/public/immersive` e a ponte `window.__eldoria`;
- catálogo Ragnarok (97 jobs, 1.732 skills, 14.397 itens, 965 mapas);
- fichas Ragnarok, HP/SP/skills/equipamento;
- console do mestre e comandos já implementados;
- mesa 5e narrada.

Nenhum desses arquivos foi removido. `git status` não tinha deleções
rastreadas; só havia arquivos novos não usados, agora removidos.

## 5. Próximo passo dependente de asset

Sem o mirror/GRF, não há como renderizar Prontera de novo. O código não
reconstrói a geometria do mapa.

Assim que houver uma destas fontes:

- backup do host;
- GRF/cliente;
- cache local;

eu:

1. copio os assets para o nosso storage;
2. ajusto `VITE_MAPS_URL` para same-origin;
3. mantenho o viewer e o visual Ragnarok;
4. valido Prontera + portal + NPCs;
5. sigo com modo de campanha e roster do mestre.

## 6. Enquanto isso

Podemos avançar sem tocar no visual:

- modo imersivo como padrão da campanha;
- roster completo do mestre;
- item/nível para personagem vinculado;
- Kafra/portais como dados, sem trocar arte.

Mas o mapa 3D só volta com os assets originais espelhados.
