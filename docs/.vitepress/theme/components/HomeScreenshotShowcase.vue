<template>
  <section class="mt-10 grid items-center gap-8 pt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <div>
      <div class="mb-4 text-[0.78rem] font-bold uppercase tracking-[0.16em] text-[var(--vp-c-default-2)]">
        Product Preview
      </div>
      <h2 class="mb-4 text-[clamp(1.9rem,3vw,3rem)] leading-[1.02] tracking-[-0.05em] text-[var(--vp-c-default-1)]">
        Built for real data work, without looking like a generic admin panel.
      </h2>
      <p class="m-0 text-[var(--vp-c-default-2)]">
        StarQuery combines dense operational workflows with a calmer interface language. The goal
        is not just capability, but capability that still feels considered.
      </p>

      <div class="mt-5 grid gap-4">
        <div
          class="grid gap-1 rounded-[18px] border border-[var(--vp-c-border)] bg-[linear-gradient(180deg,var(--vp-c-bg),var(--vp-c-bg-soft))] px-4 py-4"
        >
          <strong class="text-[0.98rem] tracking-[-0.02em] text-[var(--vp-c-default-1)]">One consistent workspace</strong>
          <span class="text-[var(--vp-c-default-2)]">Queries, browsers, editors, exports and admin workflows follow the same design logic.</span>
        </div>
        <div
          class="grid gap-1 rounded-[18px] border border-[var(--vp-c-border)] bg-[linear-gradient(180deg,var(--vp-c-bg),var(--vp-c-bg-soft))] px-4 py-4"
        >
          <strong class="text-[0.98rem] tracking-[-0.02em] text-[var(--vp-c-default-1)]">Dense, but readable</strong>
          <span class="text-[var(--vp-c-default-2)]">Power features stay accessible without collapsing into noisy, cramped tooling.</span>
        </div>
        <div
          class="grid gap-1 rounded-[18px] border border-[var(--vp-c-border)] bg-[linear-gradient(180deg,var(--vp-c-bg),var(--vp-c-bg-soft))] px-4 py-4"
        >
          <strong class="text-[0.98rem] tracking-[-0.02em] text-[var(--vp-c-default-1)]">Use it solo or with a team</strong>
          <span class="text-[var(--vp-c-default-2)]">The same experience works for quick local sessions and for shared, browser-based deployments.</span>
        </div>
      </div>
    </div>

    <div class="relative">
      <img
        class="block h-auto w-full drop-shadow-[0_30px_80px_rgba(17,24,39,0.14)]"
        src="/screenshot.png"
        alt="StarQuery screenshot"
      />
    </div>
  </section>
</template>
