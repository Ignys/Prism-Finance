import { Wallet } from "lucide-react";
import { DEFAULT_WALLET_ID, useFinanceWallets } from "../../context/FinanceContext";
import { Header } from "../home/Header";
import { DisplayModal } from "../modal/DisplayModal";
import { AddWallet } from "../modal/AddWallet";
import { useModal } from "../../context/ModalContext";

export function BalancePage() {
    const wallets = useFinanceWallets();
    const { openModal } = useModal();

    return (
        <>
            <DisplayModal />
            <main className="justify-center text-center text-white p-5 ">
                <Header />
                <div className="flex justify-center gap-2 mt-5">
                    <section className="space-y-2">
                        <div className="flex flex-col gap-1 w-90">
                            {wallets.map((wallet) => {
                                return wallet.id === DEFAULT_WALLET_ID ? (
                                    <div key={wallet.id} className="bg-neutral-900 p-2 rounded-lg items-center flex gap-2">
                                        <Wallet className="rounded-xl p-2" size={64} color="#ffffff" strokeWidth={1.8} />
                                        <div className="flex flex-col text-left ml-2">
                                            <span className="text-base font-light">Sua carteira</span>
                                            <span className="text-lg font-medium">R${wallet.balance.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={wallet.id} className="bg-neutral-900 p-2 rounded-lg flex items-center gap-2">
                                        <img src={wallet.icon} className="w-[64px] rounded-lg" alt="" />
                                        <div className="flex flex-col text-left ml-2">
                                            <span className="text-base font-light">{wallet.name}</span>
                                            <span className="text-lg font-medium">R${wallet.balance.toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div>
                                <button onClick={() => openModal(<AddWallet />)} className=" w-full bg-neutral-950 hover:bg-neutral-900 duration-200 p-2 rounded-lg">
                                    Criar nova carteira
                                </button>
                            </div>
                        </div>
                    </section>
                    <section className="flex flex-col gap-2">
                        <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                            <p className="font-light text-white/50">Anterior</p>
                            <span>R$0.00</span>
                        </div>
                        <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                            <p className="font-light text-white/50">Atual</p>
                            <span>R$0.00</span>
                        </div>
                        <div className="p-3 bg-neutral-900 w-50 text-left rounded-lg">
                            <p className="font-light text-white/50">Projecao</p>
                            <span>R$0.00</span>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
