import { HIT_DIE_BY_CLASS } from "./character-rules";

export interface ClassInfo {
  description: string;
  primaryAbility: string;
  savingThrows: string[];
  features: string[];
}

export interface RaceInfo {
  description: string;
  abilityBonus: string;
  speed: string;
  traits: string[];
}

export const CLASS_INFO: Record<string, ClassInfo> = {
  Guerreiro: {
    description:
      "Mestre em combate marcial, versado em uma ampla gama de armas e armaduras.",
    primaryAbility: "Força ou Destreza",
    savingThrows: ["Força", "Constituição"],
    features: [
      "Estilo de Combate: escolha uma especialização de luta",
      "Retomar o Fôlego: recupera pontos de vida em combate",
      "Ataque Extra (a partir do nível 5)",
    ],
  },
  Mago: {
    description:
      "Estudioso da magia arcana, conjura feitiços através de um livro de magias.",
    primaryAbility: "Inteligência",
    savingThrows: ["Inteligência", "Sabedoria"],
    features: [
      "Conjuração: lança magias arcanas a partir do livro de magias",
      "Recuperação Arcana: recupera espaços de magia em descanso curto",
    ],
  },
  Ladino: {
    description:
      "Especialista em furtividade, perícias e golpes precisos contra alvos desprevenidos.",
    primaryAbility: "Destreza",
    savingThrows: ["Destreza", "Inteligência"],
    features: [
      "Perícia: dobra o bônus de proficiência em perícias escolhidas",
      "Ataque Furtivo: dano extra contra alvos desprevenidos",
      "Ação Ardilosa: usa Disparada, Desengajar ou Esconder como ação bônus",
    ],
  },
  Clerigo: {
    description: "Canal de poder divino, cura e protege seus aliados em nome de uma divindade.",
    primaryAbility: "Sabedoria",
    savingThrows: ["Sabedoria", "Carisma"],
    features: [
      "Conjuração: lança magias divinas concedidas por sua divindade",
      "Domínio Divino: escolha um domínio que concede poderes adicionais",
      "Truques: conhece magias menores de uso ilimitado",
    ],
  },
  Barbaro: {
    description:
      "Guerreiro feroz que canaliza fúria primal para golpes devastadores e resistência sobre-humana.",
    primaryAbility: "Força",
    savingThrows: ["Força", "Constituição"],
    features: [
      "Fúria: bônus de dano e resistência a dano físico em combate",
      "Defesa sem Armadura: CA extra baseada em Constituição",
      "Ataque Descuidado: vantagem em ataques corpo a corpo, mas expõe o atacante",
    ],
  },
  Bardo: {
    description:
      "Artista versátil que tece magia através de música, palavras e inspiração.",
    primaryAbility: "Carisma",
    savingThrows: ["Destreza", "Carisma"],
    features: [
      "Conjuração: lança magias a partir de um repertório versátil",
      "Inspiração de Bardo: concede um dado de bônus a um aliado",
      "Conhecimento em Várias Áreas: proficiência extra em perícias",
    ],
  },
  Druida: {
    description:
      "Guardião da natureza que conjura magias primitivas e pode assumir formas animais.",
    primaryAbility: "Sabedoria",
    savingThrows: ["Inteligência", "Sabedoria"],
    features: [
      "Conjuração: lança magias da natureza",
      "Druídico: conhece a linguagem secreta dos druidas",
      "Forma Selvagem (a partir do nível 2): transforma-se em animais",
    ],
  },
  Monge: {
    description:
      "Lutador disciplinado que canaliza energia interior (ki) em golpes rápidos e precisos.",
    primaryAbility: "Destreza e Sabedoria",
    savingThrows: ["Força", "Destreza"],
    features: [
      "Defesa sem Armadura: CA extra baseada em Sabedoria",
      "Artes Marciais: usa Destreza em golpes desarmados e desbloqueia ataques bônus",
    ],
  },
  Paladino: {
    description:
      "Guerreiro sagrado ligado por um juramento, combina força marcial com magia divina.",
    primaryAbility: "Força e Carisma",
    savingThrows: ["Sabedoria", "Carisma"],
    features: [
      "Sentido Divino: detecta presenças celestiais, infernais ou mortas-vivas",
      "Imposição de Mãos: reserva de cura que pode usar com um toque",
    ],
  },
  Patrulheiro: {
    description:
      "Caçador e explorador que combina perícia em combate com magia e conhecimento da natureza.",
    primaryAbility: "Destreza e Sabedoria",
    savingThrows: ["Força", "Destreza"],
    features: [
      "Inimigo Predileto: vantagem ao rastrear e recordar informações sobre certos inimigos",
      "Explorador Nato: especialista em um tipo de terreno favorito",
    ],
  },
  Feiticeiro: {
    description:
      "Conjurador nato cuja magia flui de uma origem mágica inata, como sangue dracônico.",
    primaryAbility: "Carisma",
    savingThrows: ["Constituição", "Carisma"],
    features: [
      "Conjuração: lança magias a partir de um repertório limitado, mas flexível",
      "Origem Mágica: define a fonte do seu poder inato e concede traços únicos",
    ],
  },
  Bruxo: {
    description:
      "Conjurador que obtém poder através de um pacto com uma entidade sobrenatural poderosa.",
    primaryAbility: "Carisma",
    savingThrows: ["Sabedoria", "Carisma"],
    features: [
      "Patrono Sobrenatural: define a entidade com quem firmou o pacto",
      "Magia de Pacto: espaços de magia limitados, mas recuperados em descanso curto",
    ],
  },
};

export const RACE_INFO: Record<string, RaceInfo> = {
  Humano: {
    description:
      "Versáteis e ambiciosos, os humanos se adaptam a qualquer estilo de vida ou profissão.",
    abilityBonus: "+1 em todos os atributos",
    speed: "9 m",
    traits: ["Versatilidade: idioma e treinamento adicionais"],
  },
  Elfo: {
    description:
      "Povo gracioso e de longevidade extraordinária, com afinidade por magia e natureza.",
    abilityBonus: "+2 Destreza",
    speed: "9 m",
    traits: [
      "Visão no Escuro",
      "Sentidos Aguçados (proficiência em Percepção)",
      "Ancestral Feérico (vantagem contra ser enfeitiçado)",
      "Transe (não precisa dormir, medita por 4 horas)",
    ],
  },
  Anão: {
    description:
      "Resistentes e tenazes, conhecidos por sua tradição em forja, mineração e combate.",
    abilityBonus: "+2 Constituição",
    speed: "7,5 m",
    traits: [
      "Visão no Escuro",
      "Resiliência Anã (resistência a dano por veneno)",
      "Treinamento de Combate Anão",
      "Conhecimento de Pedra (proficiência extra em História)",
    ],
  },
  Halfling: {
    description:
      "Pequenos, ágeis e surpreendentemente corajosos, valorizam o conforto e a comunidade.",
    abilityBonus: "+2 Destreza",
    speed: "7,5 m",
    traits: [
      "Sortudo (rerrola 1s naturais em testes)",
      "Corajoso (vantagem contra ficar amedrontado)",
      "Agilidade Halfling (move-se pelo espaço de criaturas maiores)",
    ],
  },
  "Meio-Orc": {
    description: "Fortes e resilientes, combinam a robustez orc com a determinação humana.",
    abilityBonus: "+2 Força, +1 Constituição",
    speed: "9 m",
    traits: [
      "Visão no Escuro",
      "Resiliência Implacável (volta a 1 PV ao cair a 0)",
      "Ataques Selvagens (dano extra em acertos críticos)",
      "Intimidação (proficiência)",
    ],
  },
  Tiefling: {
    description:
      "Marcados por uma herança infernal distante, carregam chifres, cauda e um legado mágico.",
    abilityBonus: "+2 Carisma, +1 Inteligência",
    speed: "9 m",
    traits: [
      "Visão no Escuro",
      "Resistência Infernal (resistência a dano de fogo)",
      "Legado Infernal (truque e magias temáticas conforme o nível)",
    ],
  },
  Draconato: {
    description:
      "Descendentes de dragões, orgulhosos guerreiros com ancestralidade e arma de sopro elemental.",
    abilityBonus: "+2 Força, +1 Carisma",
    speed: "9 m",
    traits: [
      "Ancestralidade Dracônica (define o tipo de elemento)",
      "Arma de Sopro",
      "Resistência a Dano (do tipo elemental da ancestralidade)",
    ],
  },
  Gnomo: {
    description:
      "Pequenos, curiosos e inventivos, com uma afinidade natural para magia e mecanismos.",
    abilityBonus: "+2 Inteligência",
    speed: "7,5 m",
    traits: ["Visão no Escuro", "Esperteza Gnômica (vantagem em testes mentais contra magia)"],
  },
};

export interface SubclassInfo {
  description: string;
  features: string[];
}

// Subclasses (arquétipos) do SRD de D&D 5e, organizadas por classe.
export const SUBCLASS_INFO: Record<string, Record<string, SubclassInfo>> = {
  Guerreiro: {
    Campeão: {
      description: "Foco simples e poderoso em letalidade física pura.",
      features: ["Crítico Aprimorado: ataques acertam crítico com 19 ou 20"],
    },
    "Mestre de Batalha": {
      description: "Usa manobras táticas para controlar o campo de batalha.",
      features: ["Manobras de combate alimentadas por Dados de Superioridade"],
    },
    "Cavaleiro Místico": {
      description: "Combina perícia marcial com magias arcanas de suporte.",
      features: ["Conjuração: aprende magias da lista de mago"],
    },
  },
  Mago: {
    "Escola de Abjuração": {
      description: "Especialista em magias de proteção e escudos arcanos.",
      features: ["Armadura Arcana: escudo temporário que absorve dano"],
    },
    "Escola de Adivinhação": {
      description: "Especialista em magias de previsão e manipulação do destino.",
      features: ["Portento: substitui rolagens por valores predeterminados"],
    },
    "Escola de Conjuração": {
      description: "Especialista em invocar criaturas e objetos.",
      features: ["Magia Menor Conjurada: cria objetos temporários"],
    },
    "Escola de Encantamento": {
      description: "Especialista em controlar e influenciar mentes.",
      features: ["Encantador Hipnótico: aprimora magias de encantamento"],
    },
    "Escola de Evocação": {
      description: "Especialista em magias de dano em área.",
      features: ["Esculpir Magias: poupa aliados de dano em área"],
    },
    "Escola de Ilusão": {
      description: "Especialista em ilusões e enganação.",
      features: ["Ilusão Menor Aprimorada: ilusões mais versáteis"],
    },
    "Escola de Necromancia": {
      description: "Especialista em magias de morte e mortos-vivos.",
      features: ["Tocar a Vida e a Morte: dados de cura extra"],
    },
    "Escola de Transmutação": {
      description: "Especialista em transformar criaturas e objetos.",
      features: ["Pedra de Transmutação: item mágico personalizável"],
    },
  },
  Ladino: {
    Ladrão: {
      description: "Especialista em furtos e perícia manual, ágil para escalar e usar itens.",
      features: ["Mãos Rápidas, Pés Velozes: ações bônus extras"],
    },
    Assassino: {
      description: "Especialista em eliminar alvos com golpes letais e disfarces.",
      features: ["Vantagem contra alvos surpresos vira acerto crítico"],
    },
    "Trapaceiro Arcano": {
      description: "Combina furtividade com truques arcanos de ilusão e encantamento.",
      features: ["Conjuração: aprende truques e magias de mago"],
    },
  },
  Clerigo: {
    "Domínio da Vida": {
      description: "Foco em cura e proteção dos aliados.",
      features: ["Cura Disciplinada: cura adicional ao conjurar magias de cura"],
    },
    "Domínio da Luz": {
      description: "Foco em magias de fogo e luz radiante contra as trevas.",
      features: ["Chama Sagrada bônus e Aura de Luz"],
    },
    "Domínio da Guerra": {
      description: "Foco em combate marcial abençoado pela divindade.",
      features: ["Acerto Garantido: reroll de ataques que erram"],
    },
    "Domínio do Conhecimento": {
      description: "Foco em sabedoria, perícias e magias de adivinhação.",
      features: ["Bênçãos do Conhecimento: perícias e idiomas extras"],
    },
    "Domínio da Natureza": {
      description: "Foco em magias da natureza e proficiência com armas pesadas.",
      features: ["Encanto da Natureza: afasta animais e plantas"],
    },
    "Domínio da Trapaça": {
      description: "Foco em furtividade, ilusão e trapaça.",
      features: ["Bênção do Trapaceiro: concede furtividade a um aliado"],
    },
    "Domínio da Tempestade": {
      description: "Foco em magias de tempestade, trovão e relâmpago.",
      features: ["Fúria das Tempestades: dano de reação ao ser atingido"],
    },
  },
  Barbaro: {
    "Caminho do Berserker": {
      description: "Fúria descontrolada que aumenta o dano ao custo de exaustão.",
      features: ["Frenesi: ataque corpo a corpo bônus durante a fúria"],
    },
    "Caminho do Totem Guerreiro": {
      description: "Conexão espiritual com um animal totêmico que concede poderes únicos.",
      features: ["Espírito Totêmico: escolha urso, águia ou lobo"],
    },
  },
  Bardo: {
    "Colégio do Conhecimento": {
      description: "Versatilidade através de perícias e magias de outras classes.",
      features: ["Magia Adicional: aprende magias de qualquer classe"],
    },
    "Colégio do Valor": {
      description: "Bardo guerreiro que inspira aliados em combate.",
      features: ["Proficiência em armaduras médias, escudos e armas marciais"],
    },
  },
  Druida: {
    "Círculo da Terra": {
      description: "Magia ligada aos elementos e ao terreno natural.",
      features: ["Magias adicionais conforme o terreno escolhido"],
    },
    "Círculo da Lua": {
      description: "Foco em transformação selvagem para combate.",
      features: ["Forma Selvagem de Combate: usa formas animais como armas"],
    },
  },
  Monge: {
    "Caminho da Mão Aberta": {
      description: "Mestre em técnicas de combate desarmado e controle do oponente.",
      features: ["Técnica da Mão Aberta: empurra, derruba ou atordoa"],
    },
    "Caminho da Sombra": {
      description: "Combina artes marciais com magia de sombras para furtividade.",
      features: ["Truques de Sombra: invisibilidade em pouca luz"],
    },
    "Caminho dos Quatro Elementos": {
      description: "Canaliza ki para invocar técnicas elementais como magias.",
      features: ["Disciplinas Elementais alimentadas por pontos de ki"],
    },
  },
  Paladino: {
    "Juramento de Devoção": {
      description: "Juramento clássico de honra, justiça e ordem.",
      features: ["Canalizar Divindade: Repreender o Inimigo"],
    },
    "Juramento dos Antigos": {
      description: "Juramento de proteger a luz, a vida e a beleza contra a escuridão.",
      features: ["Canalizar Divindade: Chama Feérica Protetora"],
    },
    "Juramento da Vingança": {
      description: "Juramento implacável de punir grandes malfeitores.",
      features: ["Canalizar Divindade: Voto de Inimizade"],
    },
  },
  Patrulheiro: {
    Caçador: {
      description: "Especialista em táticas contra tipos específicos de inimigos.",
      features: ["Presa do Caçador: escolha uma tática de combate"],
    },
    "Mestre das Feras": {
      description: "Forma um vínculo com um companheiro animal que luta ao seu lado.",
      features: ["Companheiro Animal"],
    },
  },
  Feiticeiro: {
    "Linhagem Dracônica": {
      description: "Sangue de dragão concede resistência e afinidade elemental.",
      features: ["Resiliência Dracônica: PV extra e CA sem armadura"],
    },
    "Magia Selvagem": {
      description: "Magia caótica e imprevisível, com surtos selvagens aleatórios.",
      features: ["Surto Selvagem: efeito mágico aleatório ao conjurar"],
    },
  },
  Bruxo: {
    "O Arquifada": {
      description: "Pacto com um senhor ou senhora feérico do Plano das Fadas.",
      features: ["Voo Feérico: invisibilidade e teleporte curto"],
    },
    "O Imundo": {
      description: "Pacto com uma entidade do submundo, focado em resistência sombria.",
      features: ["Resiliência Sombria: resistência a um tipo de dano"],
    },
    "O Grande Antigo": {
      description: "Pacto com uma entidade cósmica incompreensível, focado em controle mental.",
      features: ["Verbo Tenebroso: atordoa criaturas com sussurros"],
    },
  },
};

export interface BackgroundInfo {
  description: string;
  skillProficiencies: string[];
  feature: string;
}

export const BACKGROUND_INFO: Record<string, BackgroundInfo> = {
  Acólito: {
    description: "Serviu em um templo, auxiliando sacerdotes em rituais e cerimônias.",
    skillProficiencies: ["Intuição", "Religião"],
    feature: "Refúgio do Sacerdote: hospedagem gratuita em templos da sua fé",
  },
  "Artesão de Guilda": {
    description: "Membro de uma guilda de artesãos, reconhecido por seu ofício.",
    skillProficiencies: ["Intuição", "Persuasão"],
    feature: "Associação da Guilda: suporte e contatos da sua guilda",
  },
  Charlatão: {
    description: "Vigarista experiente em enganar e se passar por outras pessoas.",
    skillProficiencies: ["Enganação", "Prestidigitação"],
    feature: "Identidade Falsa: uma segunda identidade documentada",
  },
  Criminoso: {
    description: "Possui um histórico de atividades ilegais e contatos no submundo.",
    skillProficiencies: ["Enganação", "Furtividade"],
    feature: "Contato Criminoso: confiável para repassar mensagens e favores",
  },
  Eremita: {
    description: "Viveu isolado, em busca de iluminação espiritual ou segredos ocultos.",
    skillProficiencies: ["Medicina", "Religião"],
    feature: "Descoberta: conhece um segredo importante e oculto",
  },
  Forasteiro: {
    description: "Cresceu na natureza selvagem, longe da civilização.",
    skillProficiencies: ["Atletismo", "Sobrevivência"],
    feature: "Vagabundo: memoriza mapas e encontra comida e abrigo",
  },
  "Herói do Povo": {
    description: "Veio de origens humildes e é visto como defensor das pessoas comuns.",
    skillProficiencies: ["Adestrar Animais", "Sobrevivência"],
    feature: "Hospitalidade Rústica: pessoas comuns escondem e ajudam você",
  },
  Marinheiro: {
    description: "Passou anos navegando, enfrentando tempestades e perigos do mar.",
    skillProficiencies: ["Atletismo", "Percepção"],
    feature: "Passagem de Navio: transporte gratuito em navios",
  },
  Nobre: {
    description: "Nasceu em posição de privilégio, com riqueza e influência.",
    skillProficiencies: ["História", "Persuasão"],
    feature: "Posição Privilegiada: bem recebido em círculos da alta sociedade",
  },
  Sábio: {
    description: "Dedicou anos ao estudo, em busca de conhecimento arcano ou histórico.",
    skillProficiencies: ["Arcanismo", "História"],
    feature: "Pesquisador: sabe onde encontrar informações",
  },
  Soldado: {
    description: "Serviu em um exército, treinado em táticas e sobrevivência militar.",
    skillProficiencies: ["Atletismo", "Intimidação"],
    feature: "Posto Militar: suporte logístico de tropas aliadas",
  },
  Artista: {
    description: "Performer itinerante que encanta plateias com música, dança ou teatro.",
    skillProficiencies: ["Acrobacia", "Atuação"],
    feature: "Por Cima: hospedagem gratuita em troca de apresentações",
  },
  "Órfão de Rua": {
    description: "Cresceu nas ruas, sobrevivendo por conta própria desde cedo.",
    skillProficiencies: ["Prestidigitação", "Furtividade"],
    feature: "Contatos da Cidade: rede de informantes urbanos",
  },
};

// Matriz clássica lei x moralidade, na mesma ordem de ALIGNMENTS (3x3).
export const ALIGNMENT_INFO: Record<string, string> = {
  "Leal e Bom": "Atua com honra e dentro das regras para o bem de todos.",
  "Neutro e Bom": "Faz o bem sem se prender a tradições ou ao caos.",
  "Caótico e Bom": "Segue a própria consciência, mesmo desafiando autoridades.",
  "Leal e Neutro": "Valoriza ordem, tradição e organização acima de tudo.",
  Neutro: "Busca equilíbrio, evitando extremos de bem, mal, lei ou caos.",
  "Caótico e Neutro": "Valoriza a liberdade individual acima de ordem ou moralidade.",
  "Leal e Mau": "Usa regras e hierarquia para alcançar objetivos egoístas.",
  "Neutro e Mau": "Faz o que for preciso para benefício próprio, sem escrúpulos.",
  "Caótico e Mau": "Age com violência impulsiva, motivado por ganância ou ódio.",
};

export { HIT_DIE_BY_CLASS };
