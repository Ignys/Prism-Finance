import { AuthShell } from "../layout/AuthShell";
import { RegistryBeneficiariesSection } from "./registry/RegistryBeneficiariesSection";
import { RegistryCategoriesSection } from "./registry/RegistryCategoriesSection";
import { RegistryTagsSection } from "./registry/RegistryTagsSection";

export function RegistryPage() {
    return (
        <AuthShell>
            <div className="pt-1 flex justify-center px-4 pb-8 md:px-6">
                <section className="w-full max-w-5/6 space-y-3">
                    <div className="rounded-xl text-left">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-2xl font-semibold text-white">Cadastros</h1>
                            <p className="text-xs uppercase tracking-[0.14em] text-white/40">Categorias & Beneficiários & Tags</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-[2fr_1fr] gap-4">
                        <RegistryCategoriesSection />
                        <RegistryBeneficiariesSection />
                        <RegistryTagsSection />
                    </div>
                </section>
            </div>
        </AuthShell>
    );
}
