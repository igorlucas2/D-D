# Token e posição Ragnarok no VTT

Status: **token autoritativo persistido**.
Data: 30/10/2026.

## 1. Modelo

`VttToken` ganhou:

```text
ragnarokCharacterId String? @unique
```

Relação:

```text
RagnarokCharacter 1 ── 1 VttToken
```

Migration: `20261030070000_ragnarok_world_token`.

- um token por ficha Ragnarok;
- token SRD continua separado;
- exclusão da ficha deixa `ragnarokCharacterId` nulo.

## 2. Sincronização

```http
PUT /api/campaigns/:id/vtt/maps/:mapId/tokens/me
{ "ragnarokCharacterId": "...", "x": 12, "y": 9 }
```

Regras:

- membro da campanha;
- ficha pertence ao usuário;
- ficha vinculada à campanha;
- exatamente uma ficha por requisição (SRD ou Ragnarok);
- cria/atualiza token no mapa;
- sprite local calculado por job/gênero/cabelo;
- dono do token é o usuário da ficha.

## 3. Movimento

O endpoint de movimento existente valida:

- dono do token;
- mapa publicado;
- colisão/parede;
- turno de combate para SRD.

Token Ragnarok não entra no combate 5e.

## 4. Projeção

- `ownerId` agora vem de `character.userId` ou
  `ragnarokCharacter.userId`;
- tokens Ragnarok aparecem para outros jogadores;
- token próprio é excluído da lista de “outros”;
- NPCs não capturam tokens Ragnarok.

## 5. Teste

API:

- token criado para IGOR;
- posição 10,10;
- movimento para 12,11;
- retorno 200.

UI:

- viewer criou token em 12,9;
- nome IGOR;
- sprite `job-3-male-9.png`;
- token removido após o teste.

## 6. Limites

- o sync de posição ainda confia no cliente e só limita ao mapa
  (não valida caminho a cada segundo);
- combate, portais, NPCs e lojas ainda não usam o token Ragnarok;
- um token por ficha;
- sem canais/instâncias;
- classes avançadas usam sprite de Aprendiz se não houver cache.

## 7. Próximo

1. validar distância/caminho no sync;
2. portais usando token Ragnarok;
3. NPCs/lojas/Kafra;
4. combate Ragnarok;
5. roster do mestre.
