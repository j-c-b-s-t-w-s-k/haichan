import { Link } from 'react-router-dom'

export function ThesisPage() {
  return (
    <div className="bg-white text-black min-h-screen">
      {/* Header */}
      <div className="border-b border-black bg-black text-white">
        <div className="container mx-auto max-w-7xl p-3">
          <div className="font-mono">
            <Link to="/" className="text-xs hover:underline mb-2 block">← back to home</Link>
            <h1 className="text-lg font-bold mb-1">haichan thesis</h1>
            <p className="text-xs text-gray-300">proof-of-work mediated social interaction</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-3xl p-4">
        <div className="font-mono text-sm leading-relaxed space-y-6">
          
          {/* Abstract */}
          <section className="border border-black p-4">
            <h2 className="font-bold text-base mb-3">thesis</h2>
            <p className="text-justify mb-3">
              haichan tests the idea that an online community can be made healthier and more interesting by replacing cheap abundance (infinite posts, infinite users, zero-cost identity) with cryptographically enforced scarcity and computational friction. every meaningful action on the board is treated as a scarce, verifiable event rather than disposable "content."
            </p>
          </section>

          {/* Core Mechanism 1 */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">caps the social graph</h3>
            <p className="text-justify">
              A hard ceiling on users (256-sized tranches, invite-gated) turns the board into a finite game. You are not shouting into a global feed; you are interacting inside a closed topology whose participants are known, trackable, and costly to fake. Every user is a scarce asset. Every connection is visible and meaningful. The boundaries of the community are explicit and enforced.
            </p>
          </section>

          {/* Core Mechanism 2 */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">prices expression in computation, not money</h3>
            <p className="text-justify">
              Posting is gated by proof-of-work and protocol-level friction. You can't spam your way to visibility; you have to literally burn cycles. Every post is a small cryptographic artifact with a verifiable cost history, not a free write to an endless log. The cost is denominated in electricity and time, not capital. This creates a market where attention is earned, not bought.
            </p>
          </section>

          {/* Core Mechanism 3 */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">compresses the medium to expose the structure</h3>
            <p className="text-justify">
              Images are aggressively compressed/dithered; the interface is TUI/ssh-like rather than glossy web. By constraining bandwidth and aesthetics, haichan foregrounds structure (who can post, at what cost, with what history) over UI spectacle. The medium itself becomes transparent. What remains is pure signal: the network topology, the proof-of-work ledger, the threads and conversations.
            </p>
          </section>

          {/* Core Mechanism 4 */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">lets the board respond to work, not vibes</h3>
            <p className="text-justify">
              The global state of the board (ordering, visibility, possible actions, maybe even "seasons" or modes) is designed to be a function of aggregate work performed by participants. The community doesn't just live on the substrate; it drives it. Posts rank by accumulated PoW. Threads bump based on collective contribution. The incentive structure is transparent and verifiable.
            </p>
          </section>

          {/* Core Mechanism 5 */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">treats posts as programmable primitives</h3>
            <p className="text-justify">
              Because each post has a cryptographic pedigree and exists in a small, legible space, it can be composed into higher-order systems later: reputation markets, computational data markets, or other experiments in valuing small, dense artifacts. Posts are not locked into a single platform or social graph. They are portable, verifiable, and composable. The infrastructure is extensible.
            </p>
          </section>

          {/* Philosophical Foundation */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">philosophical foundation</h3>
            <div className="space-y-3">
              <p className="text-justify">
                <span className="font-bold">Scarcity as signal.</span> In a world of infinite information, scarcity becomes the only honest signal of value. Proof-of-work enforces scarcity not through gatekeeping or moderation, but through thermodynamics. You cannot fake the cost of hashing.
              </p>
              <p className="text-justify">
                <span className="font-bold">Skin in the game.</span> Every participant has literally invested energy in the system. This creates alignment and accountability. You can't post without cost. You can't join without invitation. You can't game the system without burning real resources.
              </p>
              <p className="text-justify">
                <span className="font-bold">Transparent mechanisms.</span> The rules are cryptographic, not algorithmic. There is no hidden recommendation engine, no engagement metrics driving visibility. What you see is determined by observable, verifiable work.
              </p>
              <p className="text-justify">
                <span className="font-bold">The medium as message.</span> By stripping away the glossy interface and constraining bandwidth, haichan forces the community to confront the underlying structure. The interface doesn't hide complexity; it exposes it.
              </p>
            </div>
          </section>

          {/* Implementation Notes */}
          <section className="border border-black p-4">
            <h3 className="font-bold text-base mb-3">implementation & scope</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-bold">User cap:</span> 256 users per tranche, invite-gated. Enforced at registration.
              </p>
              <p>
                <span className="font-bold">Proof-of-work:</span> SHA-256 mining with target prefix (21e8). All posts require valid PoW before submission. Points accumulate on user accounts.
              </p>
              <p>
                <span className="font-bold">Interface:</span> Monospace font, high-contrast black and white, minimal graphics. Dithered image rendering. ASCII-inspired layout.
              </p>
              <p>
                <span className="font-bold">Content ranking:</span> Threads and posts rank by total accumulated PoW. Newer threads bump to top based on recent contributions.
              </p>
              <p>
                <span className="font-bold">Composability:</span> Each post is tagged with its mining challenge, nonce, hash, and points. This data can be extracted for external analysis or value systems.
              </p>
            </div>
          </section>

          {/* Closing Thought */}
          <section className="border border-black p-4 bg-black text-white">
            <p className="text-justify">
              haichan is not a social network optimized for engagement or growth. It is an experiment in what community looks like when you remove the economics of attention and replace it with the physics of work. The outcome is uncertain. But the question is clear: what happens when you make a system where your voice is limited, your participation is costly, and your identity is tied to the work you've done?
            </p>
          </section>

          {/* Navigation */}
          <div className="flex gap-2 py-4 justify-center border-t border-black">
            <Link to="/" className="border border-black px-3 py-1 font-bold text-xs hover:bg-black hover:text-white transition">
              ← home
            </Link>
            <Link to="/board/general" className="border border-black px-3 py-1 font-bold text-xs hover:bg-black hover:text-white transition">
              → start mining
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
