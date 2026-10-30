import { Plus } from "lucide-react";

/** Silhueta da barra do topo: mostra o que a página vira quando houver orçamentos. */
const SAMPLE_WIDTHS = [28, 18, 9, 14];

export function BudgetsEmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex min-h-[380px] flex-col justify-center gap-8 rounded-2xl border border-white/[0.08] bg-[#111111] p-6 sm:p-10">
            <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                {SAMPLE_WIDTHS.map((width, index) => (
                    <span key={index} className="h-full bg-white/20" style={{ width: `${width}%` }} />
                ))}
            </div>

            <div className="max-w-lg">
                <p className="text-2xl font-semibold tracking-tight text-white">Defina um teto para o que você gasta</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                    Escolha quais despesas entram — categorias, despesas recorrentes, tags, beneficiários ou um trecho da descrição — e quais ficam de fora. O Prism acompanha o
                    lançado, o previsto e avisa antes de estourar.
                </p>
                <button
                    type="button"
                    onClick={onCreate}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/85"
                >
                    <Plus size={15} />
                    Criar primeiro orçamento
                </button>
            </div>
        </div>
    );
}
