# Token Magic FX: validação e proposta para o Eldoria

Análise em 16/10/2026 do arquivo `module.json` fornecido na ocasião. **Estado: proposta arquivada por decisão do usuário em 16/10/2026.** O desenvolvimento segue a [especificação própria de imersão](./11-imersao.md). O texto abaixo fica apenas como histórico da avaliação; não compõe o plano de implementação.

## Resultado da validação

O arquivo é um manifesto de instalação do **Token Magic FX 0.8.4 para Foundry VTT**. Foi lido como UTF-8 e passou por `JSON.parse`. A comparação estrutural com o [manifesto oficial da tag 0.8.4](https://raw.githubusercontent.com/Feu-Secret/Tokenmagic/0.8.4/tokenmagic/module.json) e com o endereço `manifest` do próprio arquivo retornou igualdade. Não foi necessário corrigir o JSON.

| Verificação | Resultado |
| --- | --- |
| Identidade | `id: tokenmagic`, `title: Token Magic FX`, `version: 0.8.4` |
| Compatibilidade declarada | Foundry mínimo `14`, verificado pelo autor em `14.363`; não é versão do Node, Next.js ou do Eldoria |
| Dependência obrigatória | Módulo Foundry `lib-wrapper` |
| Endereço `manifest` | HTTP 200; na consulta retornou o mesmo manifesto 0.8.4 |
| Endereço `download` | HTTP 200 via HEAD; ZIP anunciado com 3.577.458 bytes |
| `styles: [{ "src": "styles/tokenmagic.css" }]` | Igual ao oficial; a API v14 usa uma lista de objetos para estilos |
| Idiomas | Dez entradas, incluindo `pt-BR`; acentos preservados em UTF-8 |
| Conteúdo local | Nenhum dos 15 caminhos de scripts, estilos, packs e idiomas existe na raiz deste projeto |

O formato de estilos também consta no [schema oficial do Foundry v14](https://foundryvtt.com/api/v14/classes/foundry.packages.BaseModule.html#defineschema). Não é necessário convertê-lo para uma lista de strings.

Os recursos ausentes são `libs/filters/pixi-filters.js`, `module/bundle/tokenmagic.js`, `styles/tokenmagic.css`, os dois diretórios de `packs` e os dez arquivos de `lang`. Isso confirma que foi adicionado apenas o manifesto. No Foundry, ele descreve um pacote instalado em `Data/modules/tokenmagic`, como explica a [documentação de módulos](https://foundryvtt.com/article/module-development/).

**Limite da validação:** não houve execução em uma instalação Foundry nem download/inspeção integral do ZIP. Igualdade com o manifesto oficial e resposta HTTP não demonstram funcionamento do módulo dentro do Eldoria.

## Compatibilidade com o jogo atual

O Eldoria tem frontend Next.js/React, mesa 2D em elementos HTML/CSS e mesa 3D em Three.js/React Three Fiber. O backend é NestJS, com Prisma e Socket.IO. Não há carregador de módulos Foundry nem dependência direta de PixiJS nos `package.json` consultados.

O [código do Token Magic 0.8.4](https://raw.githubusercontent.com/Feu-Secret/Tokenmagic/0.8.4/tokenmagic/module/tokenmagic.js) usa `game`, `canvas`, `PIXI` e utilitários `foundry`; seus [eventos de token](https://raw.githubusercontent.com/Feu-Secret/Tokenmagic/0.8.4/tokenmagic/module/placeables/token.js) dependem de `Hooks` e documentos do Foundry. Baixar o ZIP ou adicionar um `<script>` não fornece esse ambiente. `socket: true` também não conecta o módulo ao gateway do Eldoria.

| Caminho | Impacto | Avaliação |
| --- | --- | --- |
| Instalar o módulo em Foundry | Exige um ambiente Foundry e seu modelo de dados | Só atende a uma mesa executada no Foundry |
| Portar o motor Token Magic | Adaptar APIs Foundry, documentos, filtros Pixi e sincronização; a 3D ainda precisa de outra implementação | Esforço alto para a arquitetura atual |
| Criar efeitos nativos inspirados nos recursos visuais | Reutilizar React/CSS/Three.js e eventos existentes | **Recomendado para o Eldoria** |

O repositório publica o código sob [GPL-3.0](https://github.com/Feu-Secret/Tokenmagic/blob/0.8.4/LICENSE). Uma portabilidade com reutilização de código deve incluir a análise dessa licença e das licenças dos assets incorporados. A proposta abaixo usa implementação própria e não depende de copiar macros, shaders ou imagens do pacote.

## Onde agregar valor

| Recurso | Base existente | Evolução proposta |
| --- | --- | --- |
| Auras e condições | `renderToken` já aplica anel vinho para condições e cinza para caído na 2D | Diferenciar condições conhecidas por cor/ícone e brilho discreto; manter anel genérico para texto livre |
| Dano e cura | `useTableCombat` recebe `table:combat` e cria números flutuantes | Pulso curto no token a partir do mesmo evento autorizado |
| Paridade 3D | `TokenPawn` desenha o peão e destaca seleção, mas não recebe estado de combate | Receber a mesma descrição de efeito da 2D e desenhar anel/material correspondente |
| Efeitos manuais | Inspetor do mestre e atualização de token já existem | Presets como aura arcana, fogo, gelo e veneno, removíveis pelo mestre |
| Magias e áreas | `castSpell` consome slots; não recebe alvo ou posição | Etapa posterior: modelar origem, alvo/área e entrega do evento antes de animar projéteis e explosões |

### Primeira entrega: efeitos derivados do combate

1. Criar um catálogo próprio de presets em `frontend/src/lib/token-effects.ts`, com IDs estáveis e aparência equivalente em 2D e 3D. Os nomes e arquivos novos desta seção são propostas.
2. Usar [`table-combat.tsx`](../frontend/src/components/campaigns/table-combat.tsx) como fonte dos eventos e condições já autorizados. Normalizar nomes de condições conhecidos; preservar texto e indicador genérico para os demais. Só usar `damage`/`heal` quando `delta` estiver disponível; `delta: null` permite apenas o estado descritivo, e `delta: 0` não deve disparar um pulso de cura.
3. Integrar uma camada decorativa em [`vtt-panel.tsx`](../frontend/src/components/campaigns/vtt-panel.tsx), junto de `renderToken`. O botão atual tem `overflow-hidden`: a aura externa precisa de um invólucro/camada própria para não ser cortada. Manter seleção e arraste funcionando.
4. Passar os mesmos efeitos para [`vtt-table-3d.tsx`](../frontend/src/components/campaigns/vtt-table-3d.tsx) e renderizá-los junto de `TokenPawn`, com anéis e materiais nativos. Na 3D, posicionar pelo token no mundo, respeitando câmera e escala do mapa.
5. Adicionar preferência local `tokenEffects: full | reduced | off` em [`table-prefs-store.ts`](../frontend/src/stores/table-prefs-store.ts), com modo reduzido quando solicitado pelo sistema. Preservar os textos de condição e estado mesmo com efeitos desligados; pausar animações com a aba oculta.

Essa entrega pode usar os dados atuais, sem migração do banco ou novo evento de socket. A limitação existente de associação precisa ser tratada: `participantForToken` usa `characterId` e depois nome para monstros. Dois goblins com o mesmo nome podem receber o efeito do participante errado. Quando o vínculo for ambíguo, suprimir o efeito específico; para automação confiável, evoluir para um vínculo explícito entre participante e token.

### Segunda entrega: presets persistentes do mestre

Adicionar ao modelo `VttToken` uma lista de efeitos, com migração, serialização e tipo de frontend correspondentes. Um registro pode conter `id`, `preset`, `color`, `intensity` e `enabled`; aceitar apenas presets conhecidos, cor válida e intensidade limitada, com no máximo três efeitos por token como orçamento inicial.

A edição deve passar por [`CreateVttTokenDto`](../backend/src/vtt/dto/create-vtt-token.dto.ts), [`UpdateVttTokenDto`](../backend/src/vtt/dto/update-vtt-token.dto.ts) e [`VttService`](../backend/src/vtt/vtt.service.ts), mantendo a autorização de mestre. A persistência pode usar a atualização de mapa existente em [`vtt.gateway.ts`](../backend/src/vtt/vtt.gateway.ts); a reconexão recompõe os efeitos a partir do snapshot, sem transmitir quadros de animação.

A projeção em [`vtt.projection.ts`](../backend/src/vtt/vtt.projection.ts) deve continuar excluindo tokens ocultos e cobertos pela névoa. O efeito acompanha somente tokens autorizados e sua área deve ser recortada pela visibilidade para não invadir células ocultas. Aparência de invisibilidade não altera a regra de quem pode enxergar o token; brilho decorativo não muda `lightRadius`.

### Terceira entrega: conjuração e áreas

Definir o contrato de ação de magia com mapa, origem e alvo/área, validar permissões e criar um evento transitório do servidor. Efeitos temporários precisam de identificador, duração e descarte ao trocar de mapa; não devem reaparecer após reconexão. A renderização acompanha o resultado da regra, sem calcular dano ou gastar slots por conta própria.

## Critérios de aceite para a implementação

- Mestre e jogador veem a condição/efeito correto no mesmo token; nomes repetidos não produzem associações arbitrárias.
- Tokens ocultos e regiões cobertas pela névoa não são revelados por aura, partículas ou payload de efeito.
- Dano oculto continua com `delta: null` e sem intensidade proporcional ao valor secreto.
- Arraste, seleção, zoom e troca 2D/3D continuam funcionando, inclusive em 375 px.
- Movimento reduzido oferece indicadores estáticos; desligar efeitos preserva informações textuais.
- Presets inválidos e alterações por jogador são recusados no servidor; efeitos persistentes sobrevivem à reconexão e transitórios não se repetem.
- Medir desempenho com 20 tokens e até três efeitos por token antes de ampliar o catálogo; liberar recursos ao remover tokens ou trocar de mapa.

## Verificações realizadas nesta análise

Leitura e parse UTF-8 com Node.js; comparação estrutural via `isDeepStrictEqual` com dois manifestos oficiais; verificação de existência dos 15 caminhos locais; requisições HTTP dos links; leitura do código relevante de renderização, combate, projeção, DTOs e conjuração. Foram alterados apenas documentos; nenhuma integração de runtime foi executada.
