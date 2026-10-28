# Mesa: hierarquia, crônica pública e ficha rápida

Status: **implementada**.
Última atualização: 28/10/2026.

## 1. Ordem da mesa

A página da campanha passou a seguir esta leitura:

1. **Cabeçalho** com nome, papel, número de participantes e foco no mapa.
2. **Cena do grupo** — onde o grupo está e o vínculo das fichas.
3. **Navegação principal**:
   - Mesa;
   - **Mesa narrada** (crônica pública);
   - Exploração;
   - Diário;
   - Memórias;
   - Mundo;
   - Comandos;
   - Intenções;
   - ferramentas do mestre: Copiloto, Prazos, Cenário.
4. **Crônica pública + Companhia** — a última cena narrada e os cards.
5. **Mesa virtual** — mapa, tokens e ferramentas.
6. **Painéis laterais** — Companhia, Combate e Jornada.

“Mestre IA” foi renomeado para **Mesa narrada**. A crônica não fica mais
escondida apenas em uma ferramenta de mestre.

## 2. Quem vê o quê

| Área | Público |
| --- | --- |
| Crônica pública / Mesa narrada | Todos os membros |
| Cards de PV, CA, condições e magia | Todos os membros |
| Ficha rápida e itens/magias | Todos os membros |
| Cena do grupo | Todos os membros |
| CENÁRIO / lore do mestre | Somente mestre |
| Copiloto, Prazos, configurações da IA | Somente mestre |
| Controles do mestre na Mesa narrada | Somente mestre |

A API da Mesa narrada retorna apenas eventos de audiência **PUBLIC**. Segredos
do cenário continuam no Caderno do mestre.

## 3. Cards da companhia

Na Mesa raiz, os cards ficam **sobre o palco do mapa**, no canto inferior direito,
como um HUD compacto: podem ser recolhidos para iniciais e reabertos. A crônica
pública ocupa a largura toda acima do mapa.

Nas subpáginas (Cenário, Exploração, Memórias etc.), uma **Companhia flutuante**
fica no canto inferior esquerdo.

Cada card mostra:

- nome e iniciais;
- PV atual/máximo e barra;
- PV temporários;
- CA;
- **Magia disponível/total** (espaços de magia, não “mana”);
- condições ativas e rodadas restantes.

O sistema não tem recurso “mana”; o equivalente são os espaços de magia por
nível. O rótulo da interface usa **Magia**.

## 4. Ficha rápida minimizável

Clicar em um card abre um **drawer não-modal** à direita:

- não usa backdrop;
- não fecha ao clicar no mapa;
- pode ser **minimizado** para uma pílula “Ficha de …”;
- pode ser fechado;
- abas **Resumo**, **Itens** e **Magias**;
- mostra condições, espaços, concentração e link para a ficha completa.

## 5. Atualização

- Cards e crônica: polling de **15 s** na Mesa e **20 s** no widget.
- Ficha rápida: mesma fonte da Mesa narrada.
- O HUD de combate continua em tempo real pelo socket.

## 6. Limites

- Não há “mana” separada; usar espaços de magia.
- O HUD do mapa cobre uma parte do canto inferior direito; pode ser recolhido.
- O drawer cobre a lateral direita; o restante da página segue clicável.
- O widget não aparece em `/play` (já há HUD) e a Mesa raiz usa o HUD do mapa.
- A crônica pública mostra as últimas oito cenas; o histórico completo fica em
  Memórias.
- A ficha rápida é leitura; ações de dano/cura continuam no HUD/combate.

## 7. Validação

- `tsc`, ESLint e build do frontend passaram.
- Teste Playwright: HUD do mapa abre a ficha do elfo, minimiza para a pílula
  “Ficha de elfo” e restaura; a aba **Itens** mostra Poção de Cura e Punhal.
- Teste Playwright no Cenário: widget “Companhia” abre e a ficha rápida funciona.
- Screenshots em `frontend/test-results/ui-map-overlay-final.png` e
  `frontend/test-results/ui-lore-drawer.png`.
