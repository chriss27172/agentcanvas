# Jak dodać zmienne środowiskowe w Vercel (Environment Variables)

Użyj tej instrukcji, żeby uzupełnić brakujące zmienne w projekcie Vercel. **KV_REST_API_URL** i **KV_REST_API_TOKEN** masz już – poniżej tylko to, co warto dodać.

---

## Krok 1: Wejdź w ustawienia projektu

1. Otwórz **https://vercel.com** i zaloguj się.
2. Wybierz **swój projekt** (np. agentcanvas).
3. U góry kliknij **Settings**.
4. W lewym menu wybierz **Environment Variables**.

---

## Krok 2: Dodaj zmienne pojedynczo

Dla **każdej** zmiennej z listy poniżej:

1. W polu **Key** (nazwa) wklej **dokładnie** nazwę (np. `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS`).
2. W polu **Value** (wartość) wklej odpowiednią wartość (bez cudzysłowów).
3. Zaznacz środowiska: **Production** (i ewentualnie **Preview**, jeśli chcesz to samo na podglądach).
4. Kliknij **Save**.

Powtórz dla każdej zmiennej.

---

## Lista zmiennych do dodania

### 1. NEXT_PUBLIC_AGENT_CANVAS_ADDRESS (ważne dla Base)

- **Key:** `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS`
- **Value:** adres Twojego kontraktu na Base, np.  
  `0xDBE2419328ABBf9De8C9433d9D056E7677Db75D8`  
  (weź z Basescan: transakcja → Contract / Interacted with).
- **Środowiska:** Production (i Preview jeśli chcesz).

Bez tej zmiennej kupowane piksele na Base nie będą się poprawnie pokazywać.

---

### 2. NEXT_PUBLIC_TREASURY_BASE (opcjonalne)

- **Key:** `NEXT_PUBLIC_TREASURY_BASE`
- **Value:** np. `0xf56e55e35d2cca5a34f5ba568454974424aea0f4`  
  (używane tylko jeśli chcesz inny adres niż domyślny w kodzie).
- **Środowiska:** Production (opcjonalnie Preview).

Możesz pominąć – w kodzie jest już domyślny treasury.

---

### 3. NEXT_PUBLIC_BASE_RPC_URL (opcjonalne)

- **Key:** `NEXT_PUBLIC_BASE_RPC_URL`
- **Value:** np. `https://mainnet.base.org`  
  (ustaw tylko gdy chcesz inny RPC niż domyślny).
- **Środowiska:** Production (opcjonalnie Preview).

Możesz pominąć – domyślnie używany jest `https://mainnet.base.org`.

---

### 4. NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (opcjonalne)

- **Key:** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- **Value:** ID projektu z **https://cloud.walletconnect.com** (po rejestracji i utworzeniu projektu).
- **Środowiska:** Production (i Preview jeśli używasz WalletConnect na preview).

Bez tego WalletConnect może nie działać; MetaMask / Coinbase / OKX itd. działają bez tego.

---

## Redis (KV) – już masz

Masz w Vercel: **KV_REST_API_URL**, **KV_REST_API_TOKEN** (i ewentualnie **KV_REST_API_READ_ONLY_TOKEN**, **REDIS_URL**, **KV_URL**).  
Kod obsługuje zarówno **KV_REST_API_***, jak i **UPSTASH_REDIS_REST_*** – nic więcej nie musisz dodawać dla Redis.

---

## Po dodaniu zmiennych

1. Zapisz każdą zmienną (**Save**).
2. Zrób **Redeploy**, żeby build użył nowych wartości:
   - **Deployments** → trzy kropki przy ostatnim deployu → **Redeploy**.
3. Poczekaj na koniec deployu i sprawdź stronę (Base, kupno piksela, „My pixels”).

---

## Podsumowanie – minimum dla Base

Żeby **kupowanie pikseli na Base** i ich wyświetlanie działało na Vercel, **wystarczy dodać jedną zmienną**:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` | `0xDBE2419328ABBf9De8C9433d9D056E7677Db75D8` (lub Twój adres kontraktu z Basescan) |

Reszta jest opcjonalna.
