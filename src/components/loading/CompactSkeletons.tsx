import { SkeletonBlock, SkeletonLine, SkeletonPanel } from "./SkeletonPrimitives";

export function ChartSkeleton() {
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
                    <SkeletonBlock className="mt-4 h-14 rounded-xl" />
                </div>
            </div>
        </SkeletonPanel>
    );
}

export function ModalSkeleton() {
    return (
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111111] p-5 text-white">
            <div className="mb-5 flex items-center gap-3">
                <SkeletonBlock className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                    <SkeletonLine className="w-36" />
                    <SkeletonLine className="w-24" />
                </div>
            </div>
            <div className="space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                    <SkeletonBlock key={index} className="h-11 rounded-xl" />
                ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <SkeletonBlock className="h-10 w-24 rounded-full" />
                <SkeletonBlock className="h-10 w-28 rounded-full" />
            </div>
        </div>
    );
}
