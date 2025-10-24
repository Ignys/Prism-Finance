import prismLogo from "../../assets/pngFinal.png";

export function LoadingPage() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-100 bg-neutral-900 shadow-lg/40 p-10 rounded-xl space-y-5">
                <div className="flex items-center justify-center ">
                    <img src={prismLogo} className="log w-10" alt="Prism logo" />
                </div>
                <p className="text-center text-xl font-medium">Carregando...</p>
                <div class="loading-bar-container">
                    <div class="loading-bar-progress"></div>
                </div>
            </div>
        </div>

    )
}