# Deploy AgentCanvas (Base) so transactions work

**If you see:** *"The project has restricted transfers of this token to black hole addresses"* — USDC (Circle) blocks transfers to address `0x0`. Your contract was deployed with **treasury = 0x0**. You must **redeploy** with a real treasury address.

## 1. Redeploy the contract on Base

Constructor:

```solidity
constructor(address _usdc, address _treasury)
```

**Use these values:**

| Argument   | Value |
|-----------|--------|
| `_usdc`   | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base) |
| `_treasury` | **Your wallet address** (e.g. `0xf56e55e35d2cca5a34f5ba568454974424aea0f4`). **Must NOT be `0x0000000000000000000000000000000000000000`** or USDC will reject the transfer. |

- Unclaimed pixel buy → 1 USDC goes to `_treasury`.
- Resale → 95% to seller, 5% fee to `_treasury`.

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

## 2. Set the new contract in the app

In Vercel (or `.env.local`):

```env
NEXT_PUBLIC_AGENT_CANVAS_ADDRESS=0xYourNewContractAddress
```

Redeploy the frontend. After that, “Buy with Base” will send 1 USDC to your treasury address, not to 0x0.
