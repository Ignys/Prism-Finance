import { motion } from "framer-motion";

export function LoadingPage() {
    return (
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0e0e10] px-6 text-white">
            <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[340px] w-[340px] -translate-x-1/2 rounded-full bg-emerald-400/12 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-120px] right-[-60px] h-[260px] w-[260px] rounded-full bg-white/5 blur-3xl" />

            <div
                className="relative w-full max-w-[440px] rounded-[22px] border border-white/[0.08] p-8 sm:p-10"
                style={{
                    background: "rgba(10,10,10,0.9)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2), 0 20px 50px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
            >
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                    <img src="pngFinal.png" className="w-8" alt="Prism logo" />
                </div>

                <p className="text-center text-[11px] uppercase tracking-[0.24em] text-white/35">Prism Finance</p>
                <h1 className="mt-2 text-center text-[21px] font-medium text-white/95">Preparando seu painel</h1>
                <p className="mt-2 text-center text-sm text-white/50">Sincronizando dados e carteiras...</p>

                <div className="mt-8">
                    <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/35">
                        <span>Carregando</span>
                        <span style={{ fontFamily: "'Azeret Mono', monospace" }}>aguarde</span>
                    </div>

                    <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                            className="absolute left-0 top-0 h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-500/90 via-emerald-300/85 to-white/90"
                            animate={{ x: ["-100%", "210%"] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
