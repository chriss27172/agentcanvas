# Pełna instrukcja: zmienne środowiskowe w Vercel (krok po kroku)

Wszystko w jednym miejscu. Użyj tej strony jako jedynej instrukcji.

---

## KROK 1 – Otwórz Vercel i wejdź w zmienne

1. Wejdź na: **https://vercel.com**
2. Zaloguj się.
3. Na Dashboard kliknij **nazwę projektu** (np. agentcanvas).
4. U góry kliknij **Settings**.
5. W lewym menu kliknij **Environment Variables**.

Jesteś na liście zmiennych. Teraz dodajesz zmienne z tabeli poniżej.

---

## KROK 2 – Dodawanie jednej zmiennej (powtarzaj dla każdej)

Za każdym razem:

1. Kliknij **Add New** (lub **Add**).
2. W **Key** wklej nazwę z kolumny „Key” (całą linię).
3. W **Value** wklej wartość z kolumny „Value” (całą linię, bez cudzysłowów).
4. Zaznacz **Production**. Opcjonalnie **Preview**.
5. Kliknij **Save**.

Potem z listy zmiennych znowu **Add New** i kolejna zmienna z tabeli.

---

## WSZYSTKIE ZMIENNE – gotowe do skopiowania

Skopiuj **Key** i **Value** dokładnie (bez spacji na początku/końcu).

---

### Base (kupno pikseli, canvas)

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` | `0xDBE2419328ABBf9De8C9433d9D056E7677Db75D8` |

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_TREASURY_BASE` | `0xf56e55e35d2cca5a34f5ba568454974424aea0f4` |

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_BASE_RPC_URL` | `https://mainnet.base.org` |

---

### Strona (opcjonalne)

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://agentcanvas.space` |

*(Albo Twoja domena, np. `https://twoja-domena.vercel.app`.)*

---

### WalletConnect (opcjonalne – dla opcji „WalletConnect” w portfelu)

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `` |

*(Zostaw puste albo wklej ID z https://cloud.walletconnect.com → Create Project → Project ID. MetaMask / Coinbase / OKX działają bez tego.)*

---

### Solana (opcjonalne – jeśli używasz Solana)

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_TREASURY_SOLANA` | `62ykAMhmGYE2cVw1Lq4XfmtBGsYpNRmJ4GMmokrSz1mR` |

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_SOLANA_PROGRAM_ID` | `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS` |

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_SOLANA_RPC` | `https://api.mainnet-beta.solana.com` |

---

### Redis / KV (persistence dla Solana – prawdopodobnie już masz)

Te zmienne **Vercel często ustawia sam**, gdy podłączysz Storage (Vercel KV / Upstash).  
Jeśli **już widzisz je na liście** (KV_REST_API_URL, KV_REST_API_TOKEN) – **nie dodawaj ich drugi raz**.  
Jeśli **nie ma** – dodaj (wartości weź z Vercel Storage lub z panelu Upstash):

| Key | Value |
|-----|--------|
| `KV_REST_API_URL` | *(wartość z Vercel → Storage → KV lub z Upstash)* |

| Key | Value |
|-----|--------|
| `KV_REST_API_TOKEN` | *(wartość z Vercel → Storage → KV lub z Upstash)* |

**Alternatywa** (gdy używasz Upstash bez Vercel KV):

| Key | Value |
|-----|--------|
| `UPSTASH_REDIS_REST_URL` | *(URL z panelu Upstash Redis)* |

| Key | Value |
|-----|--------|
| `UPSTASH_REDIS_REST_TOKEN` | *(token z panelu Upstash Redis)* |

*(Wystarczy albo para KV_*, albo para UPSTASH_* – nie obie.)*

---

## KROK 3 – Po dodaniu zmiennych

1. Sprawdź na liście, czy **NEXT_PUBLIC_AGENT_CANVAS_ADDRESS** jest zapisana (to najważniejsza dla Base).
2. Zrób redeploy:
   - W górnym menu kliknij **Deployments**.
   - Przy **najnowszym** deployu (pierwszy na górze) kliknij **trzy kropki** (⋮).
   - Wybierz **Redeploy**.
   - Potwierdź **Redeploy**.
3. Poczekaj, aż status będzie **Ready**.
4. Otwórz swoją stronę i sprawdź: kupno piksela (Base), My pixels, canvas.

---

## KROK 4 – Weryfikacja (gdy My pixels / canvas nie pokazują właściciela)

Jeśli po zakupie piksela na Base **My pixels** jest puste albo **kolor na canvas** się nie zmienia:

1. **Sprawdź, czy backend widzi właściwy kontrakt**
   - Otwórz w przeglądarce: `https://twoja-domena.vercel.app/api/config`
   - Powinno być: `agentCanvasAddress` = dokładnie ten sam adres, na który wysłałeś transakcję w MetaMask/Coinbase (sprawdź na basescan.org w swojej transakcji „To”).
   - Jeśli adres jest inny lub `null` – w Vercel popraw **NEXT_PUBLIC_AGENT_CANVAS_ADDRESS** i zrób **Redeploy**.

2. **Sprawdź, czy backend widzi właściciela konkretnego piksela**
   - Otwórz: `https://twoja-domena.vercel.app/api/debug-pixel?id=123` (zastąp `123` ID kupionego piksela).
   - W odpowiedzi sprawdź pole `owner`: jeśli to Twój adres (0x…) – backend czyta kontrakt poprawnie; wtedy problem może być z cache lub odświeżaniem.
   - Jeśli `owner` to `0x0000...` albo jest błąd – backend nie widzi zakupu (zły kontrakt, inna sieć albo błąd RPC). Sprawdź adres w `/api/config` i Redeploy.

3. **Odśwież dane**
   - Na stronie głównej: przycisk **„Odśwież canvas”** (po zakupie warto go kliknąć).
   - W **My pixels**: przyciski **„Odśwież”** przy sekcjach Base i Solana.
   - Canvas odświeża się też automatycznie co 25 s oraz po powrocie do karty (visibility).

---

## Checklist (odhaczaj)

- [ ] vercel.com → projekt → **Settings** → **Environment Variables**
- [ ] **Add New** → Key: `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` → Value: `0xDBE2419328ABBf9De8C9433d9D056E7677Db75D8` → Production → **Save**
- [ ] **Add New** → Key: `NEXT_PUBLIC_TREASURY_BASE` → Value: `0xf56e55e35d2cca5a34f5ba568454974424aea0f4` → Save
- [ ] **Add New** → Key: `NEXT_PUBLIC_BASE_RPC_URL` → Value: `https://mainnet.base.org` → Save
- [ ] **Add New** → Key: `NEXT_PUBLIC_SITE_URL` → Value: `https://agentcanvas.space` → Save
- [ ] **Add New** → Key: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` → Value: *(puste lub ID)* → Save
- [ ] **Add New** → Key: `NEXT_PUBLIC_TREASURY_SOLANA` → Value: `62ykAMhmGYE2cVw1Lq4XfmtBGsYpNRmJ4GMmokrSz1mR` → Save
- [ ] **Add New** → Key: `NEXT_PUBLIC_SOLANA_PROGRAM_ID` → Value: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS` → Save
- [ ] **Add New** → Key: `NEXT_PUBLIC_SOLANA_RPC` → Value: `https://api.mainnet-beta.solana.com` → Save
- [ ] Sprawdzić, czy **KV_REST_API_URL** i **KV_REST_API_TOKEN** są na liście (jeśli tak – nie duplikować)
- [ ] **Deployments** → ⋮ → **Redeploy** → poczekać na Ready
- [ ] Sprawdzić stronę w przeglądarce

---

## Minimum (tylko Base, bez Solana / WalletConnect)

Jeśli chcesz na start tylko Base i kupowanie pikseli, dodaj **tylko te 3**:

1. `NEXT_PUBLIC_AGENT_CANVAS_ADDRESS` = `0xDBE2419328ABBf9De8C9433d9D056E7677Db75D8`
2. `NEXT_PUBLIC_TREASURY_BASE` = `0xf56e55e35d2cca5a34f5ba568454974424aea0f4`
3. `NEXT_PUBLIC_BASE_RPC_URL` = `https://mainnet.base.org`

Resztę możesz dodać później według tabel powyżej.
