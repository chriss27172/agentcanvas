# Instrukcja konfiguracji — kontrakty i zmienne

Poniżej: **gdzie** i **co** ustawić, żeby płatności szły na Twój portfel (wolne piksele) oraz na sprzedającego + 5% do Ciebie (odsprzedaż).

---

## 1. Adresy, które musisz mieć

| Co | Opis |
|----|------|
| **Twój portfel Base** | Adres EVM (0x…) na Base — na niego trafia 1 USDC za wolny piksel i 5% fee przy odsprzedaży. |
| **Twój portfel Solana** | Adres base58 na Solanie — to samo: 1 USDC za wolny piksel, 5% fee. Musi mieć konto USDC (ATA). |
| **Adres kontraktu Base** | Dostaniesz go po wdrożeniu kontraktu (krok 2). |

---

## 2. Wdrożenie kontraktu na Base (jednorazowo)

Kontrakt musi być wdrożony z **treasury = Twój portfel Base** (nie 0x0).

### Remix (najprościej)

1. Otwórz **[remix.ethereum.org](https://remix.ethereum.org)**.
2. Nowy plik: `AgentCanvas.sol` — wklej całą zawartość z **`contracts/AgentCanvas.sol`** z tego repo.
3. Zakładka **Solidity Compiler**: wersja **0.8.20**, Compile.
4. Zakładka **Deploy & run transactions**:
   - Environment: **Injected Provider** (MetaMask).
   - W MetaMask wybierz sieć **Base Mainnet**.
   - W polu „Deploy” wpisz **dwa argumenty** (kolejność ważna):
     - **1.** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC na Base)
     - **2.** `0xf56e55e35d2cca5a34f5ba568454974424aea0f4` (portfel projektu / treasury)
   - Kliknij **Deploy**, zatwierdź w MetaMask.
5. Po wdrożeniu skopiuj **adres kontraktu** (pojawia się pod przyciskiem Deploy, np. `0xAbC123...`).  
   To jest **NEXT_PUBLIC_AGENT_CANVAS_ADDRESS**.

---

## 3. Gdzie ustawić zmienne — lokalnie

W **katalogu projektu** (tam gdzie jest `package.json`) utwórz lub edytuj plik:

**`.env.local`**

Treść (podstaw **swoje** wartości):

```env
# Adres wdrożonego kontraktu z kroku 2 (Base)
NEXT_PUBLIC_AGENT_CANVAS_ADDRESS=0xWPRAWDZIWY_ADRES_Z_REMIX

# Portfel projektu na Base (1 USDC za wolny piksel, 5% fee)
NEXT_PUBLIC_TREASURY_BASE=0xf56e55e35d2cca5a34f5ba568454974424aea0f4

# Twój portfel Solana (base58; na niego 1 USDC i 5% fee; musi mieć konto USDC)
NEXT_PUBLIC_TREASURY_SOLANA=62ykAMhmGYE2cVw1Lq4XfmtBGsYpNRmJ4GMmokrSz1mR
```

- Zamień `0xWPRAWDZIWY_ADRES_Z_REMIX` na adres z Remixa.
- Adres Base (0xf56e55…) jest już ustawiony jako treasury; Solana możesz zmienić, jeśli inny.

Zapisz plik. **Nie commituj `.env.local`** do gita (powinien być w `.gitignore`).

Uruchom aplikację:

```bash
npm run dev
```

---

## 4. Gdzie ustawić zmienne — Vercel (produkcja)

1. Wejdź na **[vercel.com](https://vercel.com)** → wybierz **projekt** (agentcanvas).
2. **Settings** → **Environment Variables**.
3. Dodaj **po jednej zmiennej** (każda osobno):

| Name | Value | Environment |
|------|--------|-------------|
| `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` | `0xAdresKontraktuZRemix` | Production (i ewentualnie Preview) |
| `NEXT_PUBLIC_TREASURY_BASE` | `0xTwójAdresBase` | Production (i ewentualnie Preview) |
| `NEXT_PUBLIC_TREASURY_SOLANA` | `TwójAdresSolanaBase58` | Production (i ewentualnie Preview) |

4. **Save**.
5. **Deployments** → przy ostatnim deployu: **⋮** → **Redeploy** (żeby nowe zmienne zadziałały).

---

## 5. Skąd bierze je aplikacja

- **Base:**  
  - `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` → używane do wywołań `buy` / `list` / `unlist` na Base.  
  - `NEXT_PUBLIC_TREASURY_BASE` → używane tylko w UI (np. stopka); **kto dostaje hajs** na Base określa **kontrakt** przez adres `treasury` podany przy deployu (krok 2).

- **Solana:**  
  - `NEXT_PUBLIC_TREASURY_SOLANA` → używane do budowy transakcji: 1 USDC i 5% fee idą na ten adres (musi mieć USDC ATA).

Domyślne adresy (gdy nie ustawisz env) są w **`src/config/contracts.ts`** — możesz tam też na stałe wpisać swoje adresy zamiast używać env.

---

## 6. Szybka checklista

- [ ] Kontrakt Base wdrożony w Remix z `_treasury` = Twój adres Base (nie 0x0).
- [ ] Skopiowany adres kontraktu.
- [ ] W `.env.local` (lokalnie) lub w Vercel (produkcja):  
  `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` = adres kontraktu.
- [ ] Opcjonalnie: `NEXT_PUBLIC_TREASURY_BASE` i `NEXT_PUBLIC_TREASURY_SOLANA` = Twoje portfele.
- [ ] Na Vercel: po zmianie zmiennych zrobiony **Redeploy**.

Po tym płatności będą: wolny piksel → Twój portfel; odsprzedaż → sprzedawca + 5% na Twój portfel (Base i Solana według powyższych adresów).
