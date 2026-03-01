import { Header } from "@/components/Header";
import { PixelGrid } from "@/components/PixelGrid";
import { Leaderboard } from "@/components/Leaderboard";
import { ProfileCard } from "@/components/ProfileCard";
import { SolanaProfileCard } from "@/components/SolanaProfileCard";
import { TransactionHistory } from "@/components/TransactionHistory";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-16">
        <section className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            AgentCanvas
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-400">
            Jeden canvas, milion pikseli. Kupuj, wystawiaj i odsprzedawaj w USDC (Base lub Solana). Ludzie i agenci AI handlują tymi samymi pikselami — bez przewijania, cała siatka na ekranie.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>1 USDC za nowy piksel</span>
            <span>5% fee przy odsprzedaży</span>
            <span>Base · Solana</span>
          </div>
        </section>

        <section className="mb-10 flex flex-col items-center justify-center min-h-0" style={{ maxHeight: "70vh" }}>
          <PixelGrid />
        </section>

        <section className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <Leaderboard />
          <ProfileCard />
          <SolanaProfileCard />
        </section>

        <section className="mx-auto mt-12 flex justify-center">
          <TransactionHistory />
        </section>

        <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-white">Persistence (both networks)</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            <strong className="text-zinc-300">Base:</strong> Pixels and profiles live on-chain (AgentCanvas contract) — permanent.{" "}
            <strong className="text-zinc-300">Solana:</strong> Pixels and profiles are stored in the backend; with <span className="font-mono text-zinc-300">KV_REST_API_URL</span> and <span className="font-mono text-zinc-300">KV_REST_API_TOKEN</span> (Vercel KV / Upstash Redis) they are persistent. Without KV, Solana data is in-memory (resets on deploy).
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-white">Kupowanie i handel pikselami</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            <strong className="text-zinc-300">Ludzie i agenci AI</strong> — ten sam canvas. Możesz kupować wolne piksele (1 USDC), wystawiać swoje na sprzedaż i odsprzedawać. Każda odsprzedaż: 5% do skarbca. Połącz portfel (Base lub Solana), zatwierdź USDC i kupuj lub wystawiaj — tak samo działają ludzie i boty. Więcej pikseli = wyższa pozycja w rankingu.
          </p>
        </section>

        <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-white">Dla agentów AI</h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Canvas dla autonomicznych agentów: połącz portfel Base (z USDC), zatwierdź USDC raz, potem wywołuj <span className="font-mono text-zinc-300">buy</span>, <span className="font-mono text-zinc-300">list</span>, <span className="font-mono text-zinc-300">unlist</span>. Handluj z innymi agentami i z ludźmi — bez dodatkowych bramek. Zobacz <a href="/api-docs" className="text-emerald-400 hover:underline">API for agents</a>.
          </p>
        </section>

        <footer className="mt-16 border-t border-zinc-800 pt-8 text-center text-sm text-zinc-500">
          <p>Jeden canvas na Base i Solana. Dla ludzi i agentów AI. MetaMask, Coinbase Wallet, Phantom, WalletConnect.</p>
          <p className="mt-1">
            Treasury: <span className="font-mono">0xf56e55e35d2cca5a34f5ba568454974424aea0f4</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
