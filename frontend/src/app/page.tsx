import Link from "next/link";
import { ArrowRight, BookOpenText, Compass, Dices, Map, Users } from "lucide-react";
import { Crest, OrnateDivider } from "@/components/ornamental/ornate-divider";
import { Button } from "@/components/ui/button";

const JOURNEY = [
  {
    icon: Users,
    number: "01",
    title: "Reúna sua companhia",
    description: "Crie uma campanha, convide os jogadores e dê a cada personagem um lugar na história.",
  },
  {
    icon: Map,
    number: "02",
    title: "Prepare o cenário",
    description: "Organize mapas, miniaturas e encontros em uma mesa virtual pronta para a próxima sessão.",
  },
  {
    icon: BookOpenText,
    number: "03",
    title: "Continue a aventura",
    description: "Consulte fichas, role dados e retome a campanha de onde o grupo parou.",
  },
];

function TablePreview() {
  const party = [["M", "Mira", "Exploradora"], ["T", "Tor", "Guardião"], ["E", "Elarin", "Mago"]];

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-2xl border border-primary/35 bg-card shadow-[0_28px_90px_rgba(0,0,0,0.42)] lg:rotate-[1.5deg]">
      <div className="flex h-11 items-center justify-between gap-3 border-b border-primary/25 bg-background/90 px-4 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        <div className="flex min-w-0 items-center gap-2">
          <Crest className="size-5 shrink-0 text-primary" />
          <span className="truncate font-heading font-semibold text-foreground">Mesa de Eldoria</span>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-primary"><span className="size-1.5 rounded-full bg-[#5b7353]" />Prévia da mesa</span>
      </div>
      <div className="flex border-b border-primary/20 bg-card px-4 text-[11px] font-medium tracking-wide">
        <span className="border-b-2 border-primary px-2 py-2.5 text-foreground">Pátio da guilda</span>
        <span className="px-3 py-2.5 text-muted-foreground">Companhia</span>
        <span className="px-3 py-2.5 text-muted-foreground">Diário</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_112px] sm:grid-cols-[minmax(0,1fr)_152px]">
        <div className="relative min-w-0 overflow-hidden bg-[#b8b99f]">
          <svg className="block aspect-[1.3] w-full" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="home-map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#3d4b3c" strokeOpacity=".23" /></pattern>
              <pattern id="home-map-stone" width="34" height="30" patternUnits="userSpaceOnUse"><path d="M0 15h34M17 0v15M0 15v15M34 15v15" fill="none" stroke="#7d705c" strokeOpacity=".22" strokeWidth="1.5" /></pattern>
            </defs>
            <rect width="520" height="400" fill="#a9b59b" />
            <path d="M-50 30C100-5 170 85 310 45S500-10 570 45v82C416 132 410 181 272 137S70 155-50 97Z" fill="#c7bb98" />
            <path d="M-30 311C97 291 143 340 265 309S443 259 550 307v115H-30Z" fill="#a0ae92" />
            <path d="M-20 181C99 185 94 247 187 232C272 219 339 189 538 208" fill="none" stroke="#e2cfaa" strokeWidth="53" strokeLinecap="round" />
            <path d="M-20 181C99 185 94 247 187 232C272 219 339 189 538 208" fill="none" stroke="#a29270" strokeOpacity=".35" strokeWidth="2" strokeDasharray="4 9" />
            <ellipse cx="57" cy="74" rx="39" ry="23" fill="#71866e" opacity=".55" />
            <ellipse cx="448" cy="327" rx="60" ry="32" fill="#728d79" opacity=".52" />
            <ellipse cx="458" cy="63" rx="35" ry="20" fill="#698574" opacity=".6" />
            <path d="M178 96h234v192H178z" fill="#5e4c39" stroke="#41382e" strokeWidth="8" />
            <path d="M187 105h216v174H187z" fill="#c9baa0" />
            <path d="M187 105h216v174H187z" fill="url(#home-map-stone)" />
            <path d="M187 159h76v120M263 105v54h140M345 159v120" fill="none" stroke="#5e4c39" strokeWidth="8" />
            <path d="M238 279h48M402 184v47" fill="none" stroke="#e4d7b6" strokeWidth="10" />
            <rect x="289" y="183" width="37" height="71" rx="5" fill="#775e43" stroke="#4a392b" strokeWidth="4" />
            <circle cx="224" cy="127" r="16" fill="#6c7659" stroke="#4d5848" strokeWidth="3" />
            <path d="M224 111v32M208 127h32" stroke="#a8b494" strokeWidth="2" />
            <rect x="364" y="111" width="25" height="21" rx="3" fill="#8b6b48" />
            <path d="M17 55c9-18 31-17 40 0M439 321c7-19 30-18 38 1M474 334c7-19 30-18 38 1M443 57c7-19 27-19 33 1" fill="none" stroke="#425b4b" strokeOpacity=".65" strokeWidth="6" strokeLinecap="round" />
            <rect width="520" height="400" fill="url(#home-map-grid)" />
            {[[222, 212, "M"], [352, 203, "T"], [320, 335, "E"]].map(([x, y, label]) => (
              <g key={label}><circle cx={x} cy={y} r="17" fill="#303a36" stroke="#e5c286" strokeWidth="4" /><text x={x} y={Number(y) + 6} textAnchor="middle" fill="#efe2c0" fontSize="17" fontFamily="serif">{label}</text></g>
            ))}
          </svg>
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-background/90 px-3 py-2 text-xs text-foreground shadow-lg"><Compass className="size-4 text-primary" />Pátio da guilda</div>
        </div>
        <div className="border-l border-primary/25 bg-[#20251f] p-2.5 sm:p-3">
          <p className="mb-3 border-b border-primary/25 pb-2 font-heading text-[10px] tracking-[0.14em] text-primary uppercase sm:text-xs">Companhia</p>
          {party.map(([initial, name, role]) => (
            <div key={name} className="mb-3 flex items-center gap-2 last:mb-0">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/60 bg-[#3c4739] font-heading text-xs text-foreground sm:size-9">{initial}</span>
              <span className="min-w-0"><span className="block truncate text-[11px] font-semibold leading-tight text-foreground sm:text-xs">{name}</span><span className="hidden truncate text-[10px] text-muted-foreground sm:block">{role}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-primary/25 bg-card px-4 py-3 text-xs text-muted-foreground"><Dices className="size-4 shrink-0 text-primary" /><span className="truncate">Mira rolou d20 + 4</span><span className="ml-auto shrink-0 font-semibold tabular-nums text-foreground">18</span></div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <section className="relative isolate border-b border-primary/15">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_72%_34%,rgba(181,138,80,0.12),transparent_44%),radial-gradient(ellipse_at_5%_70%,rgba(91,115,83,0.14),transparent_42%)]" />
        <div className="mx-auto grid w-full min-w-0 max-w-[1320px] grid-cols-1 items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:px-10 lg:py-28">
          <div className="relative min-w-0 max-w-xl">
            <div className="mb-6 flex items-center gap-3 text-primary"><Crest className="size-10 shrink-0" /><span className="min-w-0 font-heading text-xs font-semibold tracking-[0.16em] uppercase sm:text-sm sm:tracking-[0.22em]">Sua próxima campanha começa aqui</span></div>
            <h1 className="max-w-[12ch] font-heading text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.13] font-semibold tracking-tight text-foreground">A aventura começa à mesa.</h1>
            <p className="font-narrative mt-6 max-w-[54ch] text-xl leading-relaxed text-muted-foreground sm:text-2xl">Reúna sua companhia, prepare o cenário e deixe fichas, dados e histórias em um só lugar. Uma casa para suas aventuras de RPG.</p>
            <OrnateDivider className="mt-8 w-40" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 w-full gap-2 px-6 text-base sm:w-auto" nativeButton={false} render={<Link href="/register" />}>Começar a jogar<ArrowRight className="size-4" /></Button>
              <Button size="lg" variant="outline" className="h-12 w-full border-primary/40 px-6 text-base sm:w-auto" nativeButton={false} render={<Link href="/login" />}>Já tenho conta</Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">Para mestres, jogadores e histórias que ainda serão contadas.</p>
          </div>
          <div className="relative min-w-0"><div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" /><TablePreview /><p className="mt-4 text-center text-xs tracking-wide text-muted-foreground">Ilustração conceitual da mesa virtual</p></div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="max-w-2xl"><p className="font-heading text-xs font-semibold tracking-[0.22em] text-primary uppercase">Do convite ao último dado</p><h2 className="mt-3 font-heading text-2xl leading-tight text-foreground sm:text-3xl">Tudo para a história seguir viva</h2><p className="mt-3 text-base leading-relaxed text-muted-foreground">Um espaço para preparar a sessão e voltar ao jogo sem perder o fio da aventura.</p></div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {JOURNEY.map((item) => {
            const Icon = item.icon;
            return <article key={item.number} className="group relative overflow-hidden rounded-xl border border-primary/20 bg-card/80 p-6 shadow-[0_14px_36px_rgba(0,0,0,0.12)] transition-colors hover:border-primary/55"><div className="absolute right-5 top-4 font-heading text-4xl text-primary/15" aria-hidden="true">{item.number}</div><div className="mb-6 grid size-12 place-items-center rounded-lg border border-primary/35 bg-primary/10 text-primary"><Icon className="size-6" aria-hidden="true" /></div><h3 className="font-heading text-lg text-foreground">{item.title}</h3><p className="mt-3 max-w-[35ch] text-sm leading-relaxed text-muted-foreground">{item.description}</p></article>;
          })}
        </div>
      </section>
    </div>
  );
}
