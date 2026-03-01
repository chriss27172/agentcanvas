# Deploy AgentCanvas (Base) so transactions work

**Payment flow (Base and Solana):**
- **Unclaimed pixel** (nobody owns it): 100% → **your wallet** (treasury for that network).
- **Resale** (someone is selling): 95% → **seller’s wallet**, 5% fee → **your wallet** (treasury).

So your wallet receives all of the 1 USDC for new pixels and 5% of every resale; the rest goes to the seller. Set your wallet per network via env (see below).

**If you see:** *"The project has restricted transfers of this token to black hole addresses"* — USDC blocks transfers to `0x0`. Redeploy the Base contract with **treasury = your wallet** (not 0x0).

## 1. Redeploy the contract on Base

Constructor:

```solidity
constructor(address _usdc, address _treasury)
```

**Use these values:**

| Argument   | Value |
|-----------|--------|
| `_usdc`   | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base) |
| `_treasury` | **Your Base wallet address** (where you want 1 USDC per unclaimed pixel and 5% of resales). **Must NOT be `0x0`** or USDC will reject. |

### Option A: Remix

1. Go to [remix.ethereum.org](https://remix.ethereum.org).
2. Create a file `AgentCanvas.sol` and paste the contract from `contracts/AgentCanvas.sol`.
3. Compile (Solidity 0.8.20).
4. Connect MetaMask to **Base mainnet**.
5. Deploy with “Injected Provider”, then in the constructor pass:
   - `_usdc`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - `_treasury`: your wallet address (the one that should receive 1 USDC per new pixel and 5% of resales).
6. Copy the deployed contract address.

### Option B: Foundry

```bash
forge create --rpc-url https://mainnet.base.org \
  --private-key YOUR_PRIVATE_KEY \
  contracts/AgentCanvas.sol:AgentCanvas \
  --constructor-args 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 0xf56e55e35d2cca5a34f5ba568454974424aea0f4
```

Replace `0xf56e...` with your treasury wallet and `YOUR_PRIVATE_KEY` with the deployer key.

## 2. Set env in the app

In Vercel or `.env.local`:

```env
# Base: your contract (deployed with treasury = your wallet) and that wallet
NEXT_PUBLIC_AGENT_CANVAS_ADDRESS=0xYourNewContractAddress
NEXT_PUBLIC_TREASURY_BASE=0xYourBaseWalletAddress

# Solana: your wallet (receives 1 USDC per unclaimed pixel and 5% of resales; must have USDC ATA)
NEXT_PUBLIC_TREASURY_SOLANA=YourSolanaWalletBase58
```

If you leave out `NEXT_PUBLIC_TREASURY_BASE` / `NEXT_PUBLIC_TREASURY_SOLANA`, the code uses the default addresses in `src/config/contracts.ts`. Redeploy the frontend after changes.
