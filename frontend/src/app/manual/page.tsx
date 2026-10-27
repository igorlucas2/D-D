import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  calculateSpellSlots,
  HIT_DIE_BY_CLASS,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  proficiencyBonus,
} from "@/lib/character-rules";
import { getItemIcon, getRarityColor, getSpellIcon } from "@/lib/game-icons";
import {
  ALIGNMENTS,
  BACKGROUNDS,
  CLASSES,
  DEITIES,
  RACES,
  SUBCLASSES,
} from "@/lib/types";

const RARITIES = [
  { code: "COMMON", label: "Comum" },
  { code: "UNCOMMON", label: "Incomum" },
  { code: "RARE", label: "Rara" },
  { code: "VERY_RARE", label: "Muito rara" },
  { code: "LEGENDARY", label: "Lendária" },
  { code: "ARTIFACT", label: "Artefato" },
];

const ITEM_CATEGORIES = ["Arma", "Armadura", "Consumível", "Equipamento", "Tesouro"];

const SCHOOLS = [
  "Abjuração",
  "Adivinhação",
  "Conjuração",
  "Encantamento",
  "Evocação",
  "Ilusão",
  "Necromancia",
  "Transmutação",
];

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
const SPELL_SLOT_PREVIEW_LEVELS = [1, 5, 11, 17];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

export default function ManualPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <span className="font-heading text-sm font-medium uppercase tracking-[0.3em] text-primary">
          Manual do Jogador
        </span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Regras de Eldoria RPG</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Eldoria RPG é construído sobre o System Reference Document (SRD) de D&D 5ª edição.
          Esta página descreve exatamente quais regras e fórmulas esta plataforma usa para
          calcular atributos, perícias e magias — incluindo as poucas adaptações próprias da
          casa, marcadas como <strong>variante</strong>.
        </p>
      </div>

      <Section
        title="Atributos e modificadores"
        description="Os seis atributos clássicos de D&D 5e: Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma."
      >
        <p>
          O modificador de um atributo é calculado pela fórmula padrão do SRD:
        </p>
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
          modificador = piso((valor do atributo − 10) / 2)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="px-2 py-1 font-medium">Valor</th>
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20].map((score) => (
                  <th key={score} className="px-2 py-1 font-medium">
                    {score}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 text-muted-foreground">Modificador</td>
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20].map((score) => {
                  const mod = Math.floor((score - 10) / 2);
                  return (
                    <td key={score} className="px-2 py-1 tabular-nums">
                      {mod >= 0 ? `+${mod}` : mod}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Criação de personagem: compra de pontos"
        description="Em vez de rolar dados para os atributos iniciais, esta plataforma usa o sistema opcional de Compra de Pontos (Point Buy) do SRD."
      >
        <p>
          Cada personagem começa com todos os atributos em 8 e recebe{" "}
          <strong>{POINT_BUY_BUDGET} pontos</strong> para distribuir. Cada aumento custa
          pontos de acordo com a tabela abaixo (valores entre 8 e 15):
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="px-2 py-1 font-medium">Valor do atributo</th>
                {Object.keys(POINT_BUY_COST).map((score) => (
                  <th key={score} className="px-2 py-1 font-medium">
                    {score}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 text-muted-foreground">Custo acumulado</td>
                {Object.values(POINT_BUY_COST).map((cost, i) => (
                  <td key={i} className="px-2 py-1 tabular-nums">
                    {cost}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          Raças, antecedentes e classes não concedem bônus automáticos de atributo nesta
          versão — o ponto de partida do personagem é definido inteiramente pela compra de
          pontos.
        </p>
      </Section>

      <Section
        title="Bônus de proficiência"
        description="Cresce com o nível do personagem, seguindo exatamente a progressão padrão do SRD."
      >
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
          bônus de proficiência = 2 + piso((nível − 1) / 4)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="px-2 py-1 font-medium">Nível</th>
                {LEVELS.map((level) => (
                  <th key={level} className="px-2 py-1 font-medium">
                    {level}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 text-muted-foreground">Bônus</td>
                {LEVELS.map((level) => (
                  <td key={level} className="px-2 py-1 tabular-nums">
                    +{proficiencyBonus(level)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Dados de vida e pontos de vida"
        description="Cada classe tem um dado de vida fixo, conforme o SRD. Para evitar rolagens manuais, esta plataforma usa a média fixa do dado (variante de regra opcional do SRD)."
      >
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
          PV máximo = (piso(dado de vida / 2) + 1 + modificador de Constituição) × nível
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CLASSES.map((cls) => (
            <div
              key={cls}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
            >
              <span>{cls}</span>
              <span className="font-mono text-muted-foreground">
                d{HIT_DIE_BY_CLASS[cls] ?? 8}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Classe de armadura, iniciativa e deslocamento">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Classe de Armadura (CA)</strong>: 10 + modificador de Destreza (sem
            armadura/escudo equipados, conforme o SRD).
          </li>
          <li>
            <strong>Iniciativa</strong>: igual ao modificador de Destreza.
          </li>
          <li>
            <strong>Deslocamento</strong>: 9 metros (30 pés), o padrão da maioria das raças
            jogáveis no SRD.
          </li>
        </ul>
      </Section>

      <Section
        title="Espacos de magia"
        description="Conjuradores usam slots por nivel, calculados automaticamente a partir da classe e do nivel do personagem."
      >
        <p>
          A ficha sincroniza os slots de magia sempre que o personagem e carregado ou atualizado.
          Truques nao consomem slots; magias de nivel 1 ou maior gastam o menor slot disponivel
          com nivel suficiente. O botao de descanso longo restaura todos os slots usados.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CLASSES.filter((cls) =>
            calculateSpellSlots(cls, 20).some((slot) => slot.total > 0),
          ).map((cls) => (
            <div key={cls} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="font-medium">{cls}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {SPELL_SLOT_PREVIEW_LEVELS.map((level) => {
                  const summary = calculateSpellSlots(cls, level)
                    .filter((slot) => slot.total > 0)
                    .map((slot) => `${slot.total}x Nv ${slot.level}`)
                    .join(", ");
                  return (
                    <span
                      key={level}
                      className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground"
                    >
                      N{level}: {summary || "sem slots"}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Raças e classes disponíveis"
        description="Conjunto inicial de raças e classes do SRD habilitado nesta plataforma."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="font-heading mb-2 font-semibold">Raças</h3>
            <ul className="list-disc space-y-1 pl-5">
              {RACES.map((race) => (
                <li key={race}>{race}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-heading mb-2 font-semibold">Classes</h3>
            <ul className="list-disc space-y-1 pl-5">
              {CLASSES.map((cls) => (
                <li key={cls}>{cls}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        title="Subclasses"
        description="Arquétipos de subclasse do SRD, escolhidos na criação do personagem de acordo com a classe."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {CLASSES.map((cls) => (
            <div key={cls} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="font-medium">{cls}</p>
              <p className="text-xs text-muted-foreground">
                {(SUBCLASSES[cls] ?? []).join(" • ")}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Antecedentes"
        description="Antecedentes (backgrounds) do SRD de D&D 5ª edição."
      >
        <div className="flex flex-wrap gap-2">
          {BACKGROUNDS.map((background) => (
            <span
              key={background}
              className="rounded-full border border-border/60 px-3 py-1 text-xs"
            >
              {background}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Alinhamentos">
        <div className="flex flex-wrap gap-2">
          {ALIGNMENTS.map((alignment) => (
            <span
              key={alignment}
              className="rounded-full border border-border/60 px-3 py-1 text-xs"
            >
              {alignment}
            </span>
          ))}
        </div>
      </Section>

      <Section
        title="O Panteão de Eldoria"
        description="Divindades originais criadas para o cenário de Eldoria, inspiradas nos arquétipos clássicos de fantasia (não fazem parte do SRD)."
      >
        <ul className="list-disc space-y-1 pl-5">
          {DEITIES.map((deity) => (
            <li key={deity}>{deity}</li>
          ))}
        </ul>
      </Section>

      <Section
        title="Itens: categorias e raridades"
        description="Categorias de itens e a escala de raridade do SRD, usadas no catálogo e no inventário."
      >
        <div className="flex flex-wrap gap-3">
          {ITEM_CATEGORIES.map((category) => {
            const Icon = getItemIcon(category);
            return (
              <span
                key={category}
                className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs"
              >
                <Icon className="h-4 w-4" />
                {category}
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          {RARITIES.map((rarity) => (
            <span
              key={rarity.code}
              className={`rounded-full border border-border/60 px-3 py-1 text-xs font-medium ${getRarityColor(rarity.code)}`}
            >
              {rarity.label}
            </span>
          ))}
        </div>
      </Section>

      <Section
        title="Magias: escolas de magia"
        description="As oito escolas de magia do SRD, usadas para classificar o grimório."
      >
        <div className="flex flex-wrap gap-3">
          {SCHOOLS.map((school) => {
            const Icon = getSpellIcon(school);
            return (
              <span
                key={school}
                className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs"
              >
                <Icon className="h-4 w-4 text-primary" />
                {school}
              </span>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
