import { getPageFromPathname, type AppPage } from "../../context/PageContext";
import { SkeletonBlock, SkeletonLine, SkeletonPanel } from "./SkeletonPrimitives";

interface PageSkeletonScreenProps {
    page?: AppPage;
}

type SkeletonVariant = "home" | "planning" | "registry" | "settings" | "statement" | "transactions" | "wishlist";

function resolveSkeletonVariant(page: AppPage | undefined): SkeletonVariant {
    if (page === "planning") return "planning";
    if (page === "settings") return "settings";
    if (page === "statement") return "statement";
    if (page === "transactions" || page === "income" || page === "spending" || page === "transfer") return "transactions";
    if (page === "wishlist") return "wishlist";
    if (page === "registry" || page === "wallets" || page === "creditCards" || page === "beneficiaries" || page === "categories" || page === "tags") return "registry";
    return "home";
}

function resolveInitialLoadingPage(): AppPage {
    if (typeof window === "undefined") {
        return "home";
    }

    return getPageFromPathname(window.location.pathname);
}

export function LoadingPage() {
    return <FullPageSkeletonScreen page={resolveInitialLoadingPage()} />;
}

export function PageSkeletonScreen({ page }: PageSkeletonScreenProps) {
    const variant = resolveSkeletonVariant(page);

    return <PageSkeletonContent variant={variant} />;
}

function FullPageSkeletonScreen({ page }: PageSkeletonScreenProps) {
    const variant = resolveSkeletonVariant(page);

    return (
        <div className="min-h-screen bg-[#0e0e10] text-white">
            <div className="flex min-h-screen">
                <SkeletonSidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                    <SkeletonHeader />
                    <main className="min-w-0 flex-1 overflow-y-auto px-3 pb-4 pt-2 sm:px-4">
                        <PageSkeletonContent variant={variant} />
                    </main>
                </div>
            </div>
        </div>
    );
}

function SkeletonSidebar() {
    return (
        <aside className="hidden w-[240px] shrink-0 bg-zinc-950/70 p-2 lg:block">
            <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col justify-between">
                <div>
                    <div className="flex items-center gap-2 px-2.5 pb-2 pt-3">
                        <SkeletonBlock className="h-7 w-7 rounded-md" />
                        <SkeletonLine className="w-20" />
                    </div>
                    <div className="my-2 h-px bg-zinc-500/20" />
                    <div className="space-y-1">
                        {Array.from({ length: 7 }, (_, index) => (
                            <SkeletonBlock key={index} className="h-10 rounded-xl" />
                        ))}
                    </div>
                </div>
                <SkeletonBlock className="h-16 rounded-2xl" />
            </div>
        </aside>
    );
}

function SkeletonHeader() {
    return (
        <header className="sticky top-2.5 z-20 mx-2 mb-2.5">
            <div className="rounded-[18px] border border-white/[0.08] bg-zinc-950/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <SkeletonBlock className="h-10 w-10 rounded-[10px] lg:hidden" />
                        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                            {Array.from({ length: 4 }, (_, index) => (
                                <div key={index} className="min-w-[132px] space-y-2 px-2 py-1.5">
                                    <SkeletonLine className="w-20" />
                                    <SkeletonLine className="h-4 w-28" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <SkeletonBlock className="h-10 w-10 rounded-full" />
                </div>
            </div>
        </header>
    );
}

function PageSkeletonContent({ variant }: { variant: SkeletonVariant }) {
    if (variant === "planning") return <PlanningSkeleton />;
    if (variant === "registry") return <RegistrySkeleton />;
    if (variant === "settings") return <SettingsSkeleton />;
    if (variant === "statement") return <StatementSkeleton />;
    if (variant === "transactions") return <TransactionsSkeleton />;
    if (variant === "wishlist") return <WishlistSkeleton />;
    return <HomeSkeleton />;
}

function HomeSkeleton() {
    return (
        <div className="grid w-full gap-3 xl:grid-cols-[minmax(280px,400px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,420px)_minmax(0,700px)_minmax(0,1fr)]">
            <section className="min-w-0 space-y-2">
                <AlertCardSkeleton />
                <ListPanelSkeleton rows={5} />
            </section>
            <ChartPanelSkeleton />
            <ChartPanelSkeleton />
        </div>
    );
}

function TransactionsSkeleton() {
    return (
        <div className="flex w-full flex-col gap-3">
            <FiltersSkeleton />
            <div className="flex flex-col gap-2 2xl:flex-row-reverse">
                <div className="w-full space-y-2 2xl:w-[200px]">
                    {Array.from({ length: 3 }, (_, index) => (
                        <SummaryCardSkeleton key={index} />
                    ))}
                </div>
                <ListPanelSkeleton rows={8} className="flex-1" />
            </div>
        </div>
    );
}

function StatementSkeleton() {
    return (
        <div className="flex flex-col gap-3 2xl:flex-row">
            <div className="min-w-0 flex-1 space-y-3">
                <FiltersSkeleton compact />
                <ListPanelSkeleton rows={6} />
            </div>
            <div className="w-full space-y-2 2xl:w-[230px]">
                {Array.from({ length: 4 }, (_, index) => (
                    <SummaryCardSkeleton key={index} />
                ))}
            </div>
        </div>
    );
}

function PlanningSkeleton() {
    return (
        <div className="flex min-h-full flex-col gap-3">
            <SkeletonPanel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        <SkeletonBlock className="h-10 w-28 rounded-full" />
                        <SkeletonBlock className="h-10 w-28 rounded-full" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 4 }, (_, index) => (
                            <SkeletonBlock key={index} className="h-9 w-24 rounded-full" />
                        ))}
                    </div>
                </div>
            </SkeletonPanel>
            <div className="flex flex-1 flex-col gap-2 xl:flex-row">
                <SkeletonPanel className="min-h-[520px] flex-1">
                    <div className="grid gap-3 md:grid-cols-3">
                        {Array.from({ length: 6 }, (_, index) => (
                            <div key={index} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <SkeletonLine className="mb-4 w-24" />
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }, (_, rowIndex) => (
                                        <SkeletonBlock key={rowIndex} className="h-12 rounded-xl" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </SkeletonPanel>
                <SkeletonPanel className="min-h-[520px] xl:w-[360px]">
                    <SkeletonLine className="mb-5 w-40" />
                    <div className="space-y-3">
                        {Array.from({ length: 7 }, (_, index) => (
                            <SkeletonBlock key={index} className="h-14 rounded-xl" />
                        ))}
                    </div>
                </SkeletonPanel>
            </div>
        </div>
    );
}

function RegistrySkeleton() {
    return (
        <div className="flex min-h-[calc(100vh-8rem)] justify-center">
            <section className="w-full space-y-3">
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 5 }, (_, index) => (
                        <SkeletonBlock key={index} className="h-10 w-32 rounded-full" />
                    ))}
                </div>
                <ListPanelSkeleton rows={9} />
            </section>
        </div>
    );
}

function SettingsSkeleton() {
    return (
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] flex-col gap-5">
            <header className="flex flex-wrap items-end justify-between gap-3 px-3">
                <SkeletonLine className="h-7 w-40" />
                <SkeletonBlock className="h-10 w-36 rounded-full" />
            </header>
            <section className="flex min-w-0 flex-col gap-2 lg:flex-row">
                <aside className="w-full p-2 lg:min-w-[280px] lg:max-w-[280px]">
                    <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
                        {Array.from({ length: 3 }, (_, index) => (
                            <SkeletonBlock key={index} className="h-11 min-w-[160px] rounded-xl" />
                        ))}
                    </nav>
                </aside>
                <SkeletonPanel className="min-h-[520px] grow">
                    <FormSkeleton />
                </SkeletonPanel>
            </section>
        </div>
    );
}

function WishlistSkeleton() {
    return (
        <div className="flex min-h-[calc(100vh-8rem)] w-full flex-col">
            <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                    <SkeletonBlock className="h-12 w-40 rounded-xl" />
                    <SkeletonBlock className="h-12 w-36 rounded-xl" />
                </div>
                <div className="flex gap-2">
                    <SkeletonBlock className="h-10 w-40 rounded-full" />
                    <SkeletonBlock className="h-10 w-36 rounded-full" />
                </div>
            </header>
            <SkeletonBlock className="mb-3 h-10 rounded-xl" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                    <WishlistCardSkeleton key={index} />
                ))}
            </div>
        </div>
    );
}

function AlertCardSkeleton() {
    return (
        <SkeletonPanel>
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                    <SkeletonLine className="w-32" />
                    <SkeletonLine className="w-48" />
                </div>
                <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
        </SkeletonPanel>
    );
}

function ChartPanelSkeleton() {
    return (
        <SkeletonPanel className="min-h-[340px]">
            <div className="mb-4 flex items-center justify-between gap-3">
                <SkeletonLine className="w-36" />
                <SkeletonBlock className="h-7 w-24 rounded-full" />
            </div>
            <div className="flex flex-col gap-4 lg:flex-row">
                <SkeletonBlock className="mx-auto h-[250px] w-[250px] rounded-xl lg:mx-0" />
                <div className="flex-1 space-y-3">
                    {Array.from({ length: 6 }, (_, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <SkeletonBlock className="h-8 w-8" />
                            <SkeletonLine className="w-28" />
                            <SkeletonLine className="ml-auto w-20" />
                        </div>
                    ))}
                </div>
            </div>
        </SkeletonPanel>
    );
}

function FiltersSkeleton({ compact = false }: { compact?: boolean }) {
    return (
        <SkeletonPanel>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: compact ? 2 : 4 }, (_, index) => (
                        <SkeletonBlock key={index} className="h-10 w-28 rounded-full" />
                    ))}
                </div>
                <SkeletonBlock className="h-10 w-36 rounded-full" />
            </div>
            {!compact ? (
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                    {Array.from({ length: 4 }, (_, index) => (
                        <SkeletonBlock key={index} className="h-10 rounded-xl" />
                    ))}
                </div>
            ) : null}
        </SkeletonPanel>
    );
}

function ListPanelSkeleton({ rows, className = "" }: { rows: number; className?: string }) {
    return (
        <SkeletonPanel className={className}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <SkeletonLine className="w-40" />
                <SkeletonBlock className="h-8 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
                {Array.from({ length: rows }, (_, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <SkeletonBlock className="h-9 w-9 rounded-xl" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <SkeletonLine className="w-2/3" />
                            <SkeletonLine className="w-1/3" />
                        </div>
                        <SkeletonLine className="w-20" />
                    </div>
                ))}
            </div>
        </SkeletonPanel>
    );
}

function SummaryCardSkeleton() {
    return (
        <SkeletonPanel>
            <SkeletonLine className="mb-3 w-24" />
            <SkeletonLine className="h-5 w-32" />
        </SkeletonPanel>
    );
}

function FormSkeleton() {
    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <SkeletonLine className="w-40" />
                <SkeletonLine className="w-64 max-w-full" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 6 }, (_, index) => (
                    <SkeletonBlock key={index} className="h-12 rounded-xl" />
                ))}
            </div>
            <SkeletonBlock className="h-24 rounded-2xl" />
            <div className="flex justify-end">
                <SkeletonBlock className="h-10 w-32 rounded-full" />
            </div>
        </div>
    );
}

function WishlistCardSkeleton() {
    return (
        <SkeletonPanel>
            <SkeletonBlock className="mb-3 h-36 rounded-xl" />
            <SkeletonLine className="mb-2 h-5 w-2/3" />
            <SkeletonLine className="mb-4 w-1/3" />
            <div className="flex items-center justify-between border-t border-white/[0.07] pt-3">
                <SkeletonBlock className="h-8 w-28 rounded-full" />
                <SkeletonBlock className="h-8 w-24 rounded-full" />
            </div>
        </SkeletonPanel>
    );
}
