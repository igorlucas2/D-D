# Persistência, portais, NPCs e ficha Eldoria

Status: **correções da mesa imersiva**.
Última atualização: 28/10/2026.

## 1. Posição ao recarregar

Antes, a posição do viewer voltava ao spawn e só era enviada ao servidor se
houvesse ficha SRD vinculada.

Agora:

- a posição é salva em `localStorage` por campanha/mapa:
  `eldoria:position:<campaignId>:<mapId>`;
- o mapa selecionado é salvo em `eldoria:map:<campaignId>`;
- ao abrir, a posição salva é restaurada com `setPlayerCell`;
- se existir token do personagem no VTT, a posição do token tem prioridade;
- a gravação local acontece a cada 1 s durante exploração.

Precisão: célula do VTT (5 pés), não pixel.

## 2. Portais

Hotspots visíveis com destino ou com nome de portal/portão/entrada/caverna/
kafra/passagem agora:

- aparecem como marcadores ciano no viewer;
- são clicáveis;
- aparecem na seção **Portais** da HUD;
- com `targetMapId` e cena 3D, trocam de mapa;
- sem destino, mostram “ponto de interesse sem passagem 3D”.

Teste: **Campos de Prontera** mudou para o mapa `cmvrr9fri...` com cena 3D.

## 3. NPCs

- NPCs ambientes continuam sintéticos;
- o mestre pode usar **Trazer NPCs para a cena** para criar tokens
  persistentes no VTT;
- os tokens são posicionados perto do centro do mapa para aparecer no
  enquadramento inicial;
- o botão some quando os moradores da cena já estão persistentes;
- NPCs invocados continuam disponíveis.

Teste: 3 NPCs criados, visíveis no viewer e listados na HUD; tokens removidos
depois do teste.

## 4. Ficha de Eldoria

A HUD ganhou a aba **Ficha**:

- nome, raça, classe e nível do personagem SRD;
- PV, CA e deslocamento;
- cena/campanha atual;
- visual SRD ou Ragnarok em uso;
- atalho **Vincular ficha na Mesa** quando não há personagem.

## 5. Evidências

- `frontend/test-results/immersive-portals-npcs.png`;
- `frontend/test-results/immersive-npcs-visible.png`;
- `frontend/test-results/persist-portals.png`;
- teste de recarga: célula salva `12,8` restaurada após reload.

## 6. Limites

- posição local não atravessa navegador/dispositivo;
- sem cena 3D do mapa-múndi;
- portais sem `targetMapId` não teleportam;
- NPCs persistentes precisam ser criados pelo mestre;
- sem labels 3D sobre os sprites.
