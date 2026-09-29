# 🚁 BetaFPV Web Sim

**Przeglądarkowy symulator drona FPV** sterowany fizycznym padem **BetaFPV LiteRadio 2 SE** przez **WebHID API**.

Projekt napisany w całości w JavaScript (ES Modules) z wykorzystaniem **Three.js** do renderowania 3D. Nie wymaga instalacji — wystarczy przeglądarka oparta na Chromium.


!(/img/zdjecie.jpg)


## ✨ Funkcje

- 🎮 **Bezpośrednia obsługa pada BetaFPV LiteRadio 2 SE** przez WebHID (bez sterowników).
- 🗺️ **Kreator mapowania osi** — ruszasz drążkami, program pokazuje, które pary bajtów się poruszają, Ty przypisujesz je do funkcji drona.
- 🎯 **Automatyczna kalibracja zakresów** — program mierzy min/max/center dla każdej osi.
- 🌍 **Trzy poziomy trudności** (Łatwa / Średnia / Ekspert) z różną fizyką i scenografią.
- 🎨 **Scena 3D w Three.js**: niebo z shaderem gradientowym, mgła, cienie PCFSoft, drzewa, górki, woda, bramki, przeszkody.
- 📊 **HUD w czasie rzeczywistym** — throttle, yaw, roll, pitch, wysokość, prędkość.
- 🔄 **Auto-połączenie** z padem przy starcie (jeśli był już autoryzowany).
- 🛠️ **Narzędzie diagnostyczne** `detector.html` do analizy surowych raportów HID.

---

## ⚙️ Wymagania

### Przeglądarka
- **Chrome / Edge / Opera / Brave** w wersji **89+** (WebHID).
- ❌ Firefox i Safari **nie obsługują** WebHID.
- Strona **musi być serwowana po HTTPS** lub z `localhost` (WebHID nie działa z `file://`).

### Sprzęt
- Pad **BetaFPV LiteRadio 2 SE** (VID `0x0483`, PID `0x5750`).
- Kabel USB (pad musi być w trybie Joystick — nie w trybie ładowania).

### Serwer lokalny
Do uruchomienia potrzebny jest dowolny lokalny serwer HTTP. Przykłady:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

## 🎮 Jak korzystać

Krok 1/4 — Podłącz pad
Kliknij „Połącz z padem” i wybierz „BETAFPV Joystick” z listy urządzeń.

Krok 2/4 — Mapowanie osi
Ruszaj drążkami po kolei (każdy w każdą stronę). Obserwuj, które paski się ruszają, i przypisz odpowiednie pary (P0–P7) do funkcji:

THROTTLE — lewy drążek w górę/dół

YAW — lewy drążek w lewo/prawo

PITCH — prawy drążek w górę/dół

ROLL — prawy drążek w lewo/prawo

Kamera - 3 pooziomy najlepiej użyć przełaczników SB i SC  

Pary nieprzypisane (ustawione na ---) są ignorowane.


### ⚠️ Uwaga: mapowanie trzeba powtórzyć za każdym razem po odświeżeniu strony. Pad przy każdym podłączeniu generuje sygnał na innych parach bajtów — dlatego nie da się zapisać mapowania na stałe.

Krok 3/4 — Kalibracja zakresów
Program poprosi Cię po kolei o ruszanie każdą funkcją. Ruszaj drążkiem do oporu w obie strony — kalibracja trwa ~4 sekundy na funkcję (łącznie ~16 s).

Krok 4/4 — Wybór planszy
Wybierz poziom trudności i startuj. W locie możesz wrócić do menu przyciskiem ⬅ Menu w prawym górnym rogu.


## Sterowanie

Funkcja	Drążek	Efekt
Throttle	Lewy ↑↓	Ciąg silników (góra/dół)
Yaw	Lewy ←→	Obrót wokół osi pionowej
Pitch	Prawy ↑↓	Pochylenie przód/tył
Roll	Prawy ←→	Pochylenie na boki

Klawiatura 

P - Pauza 
K - Kamera 
Spacja - celownik


## ❌ Nie działa bezpośrednio

Pady XInput (Xbox, DualShock/DualSense) — WebHID nie ma do nich dostępu ze względów bezpieczeństwa. Wymagana migracja na Gamepad API.

Pad DJI RC-N1 (Mini 2 / Air 2 / Mini 3) — po podłączeniu przez USB nie jest rozpoznawany jako HID. Wymaga zewnętrznego konwertera (np. DJI_RC-N1_SIMULATOR_FLY_DCL) + Gamepad API.

Aparatury Radiomaster Zorro / Pocket / TBS Tango 2 — teoretycznie kompatybilne po przełączeniu w tryb USB Joystick, ale wymagają zmiany VID/PID w kodzie.

## 🤝 Wkład w projekt

Pull requesty i zgłoszenia błędów są mile widziane! Jeśli chcesz dodać obsługę nowego pada, otwórz Issue z:

Nazwą modelu,
VID/PID,
Zrzutem z detector.html (HEX + DEC).

## 📜 Licencja
  Projekt udostępniany na licencji MIT — szczegóły w pliku LICENSE.

## 🙏 Podziękowania
   Three.js — silnik 3D
   WebHID API — obsługa pada
   Społeczność FPV za feedback i testy

### Miłego latania! 🚁💨
