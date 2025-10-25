# Slash or Smash — Design Plan and Design Language

**Inspiration**  
- Space-punk vibe from the *Skooty Puff Jr* still: deep starfield, retro sci-fi ring station, chunky lettering.  
- Merch site look: dark UI, neon purple accents, rounded buttons, playful sticker energy.  
- Theme: spooky, fun, midnight carnival in space.

---

## 1) Brand North Star

**Tone**  
- Playful and energetic. Think arcade game meets game show.  
- Judges-only authority, but with showmanship.

**Keywords**  
- Cosmic, neon, witchlight, stickerbook, retro-sci-fi, arcade, dynamic.

**Logo lockup (temporary)**  
- Wordmark: "Slash or Smash" with bold typography.  
- Optional mascot: energy burst or rating star icon.

---

## 2) Color System

All colors target WCAG AA on dark backgrounds. Use the contrast notes for text.

**Core**  
- Night 900 `#0A0A12` - primary background  
- Grave 800 `#11121A` - panels  
- Witchlight 500 `#7E4BFF` - primary neon accent (≥ 4.5:1 on Night)  
- Specter 300 `#BDB7FF` - secondary accent for borders and icons  
- Bone 100 `#F5F7FF` - primary text on dark

**Status and States**  
- Ready `#6C6CFF` (calm indigo glow)  
- Voting `#13E2A1` (ecto green)  
- Locked `#FFC857` (ghost amber)  
- Results `#FF4B91` (neon magenta)  
- Error `#FF3B30`  
- Success `#34C759`

**Surface tints**  
- Nebula overlay gradient: top-left `#0A0A12` to bottom-right `#17182A`  
- Purple haze: radial `#7E4BFF` at 0-20% opacity behind hero text

**Utilities**  
- Star speckle as an SVG noise/points layer with alpha 0.08  
- Mist layer PNG with alpha 0.12 for intermissions

---

## 3) Typography

**Primary**  
- *Chakra Petch* or *Space Grotesk* for UI labels and numbers.  
- Style: Semibold for headings, Medium for controls, Regular for body.

**Display**  
- *Creepster* for large scene titles and the Results reveal. Use sparingly.  
- Alternative safer choice: *Rubik Glitch* or *Rubik Mono One* for retro sci-fi vibe.

**Type scale**  
- H1 48/56, H2 32/40, H3 24/32, Body 16/24, Small 14/20, Mono 13/18 (timer and codes).

**Effects**  
- Outer-glow for display text only: 0 0 24px Witchlight 40%.  
- No glow on body copy for readability.

---

## 4) Iconography and Shapes

- Rounded-rect components with 16px radius, “sticker” outlines at 1px Specter 300.  
- Soft shadows: 0 10px 24px rgba(0,0,0,0.45).  
- Icons: phosphor-react or lucide with 1.75px stroke, Specter 300 default.  
- Rating pips use thick outlines and fill on select.

---

## 5) Motion and Micro-interactions

- Duration short 120ms, medium 200ms, long 300ms.  
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for snappy ease-out.

**State transitions**  
- Ready → Voting: timer counts up from a dim 30 to full bright, bars slide in from baseline.  
- Voting → Locked: quick 120ms freeze pulse, then glow fades.  
- Locked → Results: card flip or vertical wipe with purple fog burst at 12% opacity.

**Vote buttons**  
- On hover: small float 2px, glow ring Witchlight 30%.  
- On select: spring scale 0.98 → 1 with ecto green aura for 100ms.

---

## 6) Layouts

**Unified Overlay `/overlay`**  
- Safe area: 1280x720 logical inside 1920x1080 to avoid stream crop.  
- Left 2/3 image canvas. Right 1/3 info rail that swaps by state.  
- Top-left state chip. Bottom center timer. Bottom-right watermark.

**Judge Console `/judge`**  
- Single column, thumb-friendly.  
- Big 1..5 buttons in a segmented control with labels below.  
- Status strip under header. Sticky footer shows current selection.

**Control `/control`**  
- Two-column: left queue and media, right run controls and live metrics.  
- Scene bar top: Ready, Voting, Locked, Results, Leaderboard.  
- Sticky audit tray at bottom with overrides history.

---

## 7) Components

**State Chip**  
- Pill with glow ring, icon changes per state: Ready rocket-idle, Voting timer, Locked lock, Results trophy.

**Timer**  
- Monospace digits with small glow. Red blink at ≤ 5s. Grace window shows thin animated border.

**Vote Bars**  
- 5 bars 1..5. Rounded ends. When results show, animate counts to final and reveal average badge.  
- Color ramp: 1 `#6C6CFF`, 2 `#7E4BFF`, 3 `#B45CFF`, 4 `#FF4B91`, 5 `#13E2A1`.

**Results Table**  
- Sticky row for average. Judge names left, scores right with emoji chips optional.  
- Reopen badge in header if round reopened.

**Buttons**  
- Primary: Witchlight 500 filled on Night.  
- Secondary: outline Specter 300 with subtle glow on hover.  
- Danger: magenta `#FF4B91` fill for destructive actions.

---

## 8) Sound Design

- Ready ambient: low space hum.  
- Voting tick: soft geiger-click at 1 Hz, accelerates last 5s.  
- Lock: camera shutter thump.  
- Results: synth swell with chime. Volume ducking to avoid clipping stream audio.

---

## 9) Accessibility

- Minimum text contrast 4.5:1, interactive 3:1 against backgrounds.  
- Focus states: 2px focus ring `#13E2A1` outer with 1px inner `#11121A`.  
- Motion-reduce: disable fog bursts, reduce glow animations.  
- Keyboard map: numbers 1..5 for producer testing on overlay off-screen.

---

## 10) Asset Pack

- Starfield SVG tile 1024px with random jitter.  
- Purple fog PNG (alpha).  
- Sticker border SVG for cards.  
- Icon set: state icons, timer glyphs, lock, ghost, trophy.  
- Sound pack wav files.

---

## 11) Implementation Notes (Tailwind-friendly)

**CSS variables**  
```css
:root {
  --night-900: #0A0A12;
  --grave-800: #11121A;
  --witch-500: #7E4BFF;
  --specter-300: #BDB7FF;
  --bone-100: #F5F7FF;

  --state-ready: #6C6CFF;
  --state-voting: #13E2A1;
  --state-locked: #FFC857;
  --state-results: #FF4B91;
}
```

**Example overlay shell**  
```html
<div class="w-screen h-screen bg-[var(--night-900)] text-[var(--bone-100)] relative overflow-hidden">
  <!-- starfield and fog -->
  <div class="absolute inset-0 opacity-10 bg-[url('/assets/starfield.svg')]"></div>
  <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(40% 40% at 70% 30%, rgba(126,75,255,.18), rgba(10,10,18,0) 70%);"></div>

  <div class="grid grid-cols-3 gap-6 p-8 h-full">
    <!-- image -->
    <div class="col-span-2 rounded-2xl overflow-hidden shadow-2xl border border-[var(--specter-300)]/20">
      <img src="/current.jpg" class="w-full h-full object-contain bg-[var(--grave-800)]"/>
    </div>

    <!-- info rail -->
    <aside class="col-span-1 space-y-4">
      <!-- state chip -->
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--specter-300)]/40 shadow"
           id="stateChip">Ready</div>

      <!-- swap this panel by state -->
      <div id="panelVoting" class="rounded-xl p-4 bg-[var(--grave-800)]/80 border border-[var(--specter-300)]/20">
        <div class="text-sm opacity-80">Average</div>
        <div class="text-4xl font-semibold">3.8</div>
        <!-- bars -->
        <div class="mt-4 space-y-2">
          <!-- repeat for 1..5 -->
          <div class="flex items-center gap-3">
            <div class="w-8 text-sm opacity-80">1</div>
            <div class="flex-1 h-4 rounded-full bg-white/10">
              <div class="h-4 rounded-full" style="width:30%; background:linear-gradient(90deg,#6C6CFF,#7E4BFF);"></div>
            </div>
            <div class="w-10 text-right text-sm">12</div>
          </div>
        </div>
      </div>
    </aside>
  </div>

  <!-- timer -->
  <div class="absolute left-1/2 -translate-x-1/2 bottom-6 text-6xl font-mono tracking-widest"
       id="timer">00:30</div>
</div>
```

**Shadcn UI mapping**  
- Badge → State Chip  
- Progress → Vote Bars (custom colors)  
- Table → Results Table  
- Button → Control actions

---

## 12) OBS Guidelines

- Overlay route: `/overlay` at 1920x1080. Disable cache.  
- Include a duplicate source with CSS transform for emergency zoom.  
- Leaderboard as separate source `/overlay/leaderboard`.  
- Color space: sRGB. Browser source FPS 60, refresh when scene becomes active.

---

## 13) Roadmap

- Build tokens and Tailwind theme.  
- Implement overlay shell and state panels.  
- Add fog and starfield layers with motion-reduce support.  
- Wire vote bar animations and timer.  
- Add sound cues and volume ducking.  
- Bake accessibility checks.

---
