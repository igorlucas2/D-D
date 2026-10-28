# Mesa em modais e modo foco

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Problema

A página da campanha empilhava:

1. cabeçalho;
2. cena do grupo;
3. navegação;
4. crônica;
5. companhia;
6. mesa virtual;
7. painéis laterais.

Em 1280×720, o mapa ficava quase fora da tela.

## 2. Nova estrutura

A página agora tem:

1. **Cabeçalho compacto** da campanha;
2. **Navegação** principal;
3. **Barra de ações da mesa**:
   - Cena;
   - Crônica;
   - Companhia;
   - Combate;
   - Jornada;
   - Mesa narrada.
4. **Mesa virtual** como área principal;
5. **Modais** para as seções, abertos sob demanda.

Cena, crônica e companhia não ocupam mais espaço vertical permanente.

## 3. Modais

Todos usam `max-h-[88dvh]` com rolagem interna e fecham por Escape, X ou clique fora:

| Modal | Conteúdo |
| --- | --- |
| Cena | cena do grupo, vínculo de fichas e chronicle de retorno |
| Crônica | última narração pública + link para a mesa narrada |
| Companhia | membros e personagens, com ficha rápida |
| Combate | encontro, iniciativa, PV e condições |
| Jornada | relógio do mundo, exploração e descanso |

## 4. Modo foco

O botão **Focar no mapa** agora:

- esconde a navegação e a barra de ações;
- esconde a descrição do cabeçalho;
- passa `compact` ao VTT;
- deixa o mapa ocupar a tela;
- mantém o HUD da companhia sobre o mapa;
- mantém o botão **Visão completa** no cabeçalho.

Em 1280×720 o mapa ocupa a maior parte da tela e os controles do VTT ficam visíveis.

## 5. Companhia

- No mapa: HUD flutuante no canto inferior direito;
- Nos modais: cards com PV, CA, magia, condições e espaços;
- Clique no card abre a **ficha rápida não-modal**;
- A ficha pode ser minimizada para a pílula “Ficha de …”.

## 6. Validação

Teste Playwright em **1280×720**:

| Modal | Tamanho |
| --- | --- |
| Crônica | 768×402 |
| Cena | 768×307 |
| Companhia | 672×252 |
| Combate | 672×220 |
| Jornada | 672×368 |

Todos cabem na tela e rolam internamente.

- `tsc`, ESLint e build do frontend passaram;
- screenshot: `frontend/test-results/workspace-small.png`;
- modo foco: `frontend/test-results/workspace-focus-small.png`.

## 7. Limites

- O VTT continua sendo o componente mais alto da página; o modo foco é o caminho para telas pequenas.
- A barra de ações some no modo foco; para abrir Cena/Crônica é preciso voltar à visão completa.
- A ficha rápida é leitura; ações continuam no HUD/combate.
- Modais não são janelas simultâneas: abrir um fecha o anterior.
