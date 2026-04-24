import { AuthShell } from "../layout/AuthShell";
import { RegistryBeneficiariesSection } from "./registry/RegistryBeneficiariesSection";
import { RegistryCategoriesSection } from "./registry/RegistryCategoriesSection";
import { RegistryTagsSection } from "./registry/RegistryTagsSection";

export function RegistryPage() {
    return (
        <AuthShell>
            <div className="flex h-[calc(95vh-5rem)] justify-center overflow-hidden px-4 pb-6 pt-1 md:px-6">
                <section className="flex h-full w-full max-w-5/6 flex-col space-y-3 overflow-hidden">
                    <div className="rounded-xl text-left">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-semibold text-white">Cadastros</h1>
                            <p className="text-xs uppercase tracking-[0.14em] text-white/40">Categorias & Beneficiários & Tags</p>
                        </div>
                    </div>
                    <div className="grid flex-1 min-h-0 grid-cols-[2fr_1fr] grid-rows-2 gap-4 overflow-hidden">
                        <RegistryCategoriesSection />
                        <RegistryBeneficiariesSection />
                        <RegistryTagsSection />
                    </div>
                </section>
            </div>
        </AuthShell>
    );
}
