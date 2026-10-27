# Telas Detalhadas (MVP)

## /login e /register
- Formulário centralizado, fundo com arte temática (gradiente + textura de pergaminho/fantasia)
- Campos: email, senha (login) / displayName, email, senha, confirmação (registro)
- Validação inline, feedback de erro da API
- Link cruzado entre login/registro

## /dashboard
- Header fixo com navegação (Personagens, Campanhas, Biblioteca, Mundo, IA, Avatar/menu)
- Card "Nível da conta" com barra de XP
- Grid de cards de personagens (retrato, nome, classe, nível) + botão "Criar personagem"
- Lista de campanhas (placeholder no MVP)
- Seção de conquistas recentes (badges)

## /characters (lista)
- Grid responsivo de cards de personagem
- Cada card: retrato, nome, raça/classe, nível, HP atual/máx (mini barra)
- Botão flutuante "+ Novo Personagem"

## /characters/new (wizard)
- Stepper de 4 etapas (Identidade, Atributos, Aparência/História, Revisão)
- Etapa Atributos: sliders/inputs para FOR/DES/CON/INT/SAB/CAR com sistema
  "point buy" simplificado (8 a 15, custo crescente) + exibição do modificador
  em tempo real
- Etapa Revisão: mostra valores calculados (CA, HP máx, iniciativa, proficiência)
  antes de confirmar

## /characters/:id (ficha interativa)
- Topo: retrato grande, nome, raça/classe/subclasse, nível, alinhamento, divindade
- Barras/resumos: HP, slots de magia e XP — todos com animação suave
- Cartão de atributos: 6 atributos com valor + modificador, CA, iniciativa, proficiência, resistências
- Abas:
  - **Inventário**: busca/filtros no inventário, busca global no catálogo de itens e drag&drop
    entre "Mochila" e "Equipados"; resumo de peso total, peso equipado e valor estimado
  - **Magias**: lista por nível, indicador de slots usados/disponíveis, toggle "preparada"
  - **História/Aparência**: texto longo + upload de retrato
- Atualização em tempo real via WebSocket (ex.: HP muda durante combate em outra aba/dispositivo)

## /dice
- Seletor de dado (D4, D6, D8, D10, D12, D20, D100) e quantidade/modificador
- Cena 3D (react-three-fiber + cannon/rapier) com animação de queda e colisão dos dados
- Resultado destacado + breakdown (ex.: "2d6+3 = 4 + 5 + 3 = 12")
- Histórico lateral com rolagens recentes (persistido via API)

## /profile
- Avatar (upload), nome de exibição, bio
- Barra de nível de conta + XP
- Grade de conquistas (desbloqueadas vs bloqueadas, com progresso)
