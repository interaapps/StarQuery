<template>
  <section class="mt-10 grid items-center gap-8 pt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <div>
      <h2 class="mb-4 text-[clamp(1.9rem,3vw,3rem)] leading-[1.02] tracking-[-0.05em] !border-t-0 !pt-0">
        Manage your favorite Databases - With the App or on a Server with the Web Panel
      </h2>
      <p class="m-0 ">
        StarQuery combines dense operational workflows with a calmer interface language. The goal
        is not just capability, but capability that still feels considered.
      </p>

      <div class="mt-5 grid gap-4">
        <div
          class="grid gap-1 rounded-[18px] border border-[var(--vp-c-border)] px-4 py-4"
          v-for="item of [
            {
              title: 'Browse Tables',
              description:
                'Browse your tables and their contents with ease. No more jumping back and forth between your databases.',
            },
            {
              title: 'SQL Editor',
              description:
                'Write and run SQL queries directly in the app. Get instant feedback and see your results in a clear, organized way.',
            },
            {
              title: 'Host it on your Server',
              description:
                'Still using PHPMyAdmin or Adminer? Host StarQuery on your server and give your team a more modern, user-friendly way to manage your databases.',
            }
          ]"
        >
          <strong class="text-[0.98rem] tracking-[-0.02em] ">{{ item.title }}</strong>
          <span>{{ item.description }}</span>
        </div>
      </div>
    </div>

    <div class="relative">
      <img
        class="block h-auto w-full"
        src="/screenshot.png"
        alt="StarQuery screenshot"
      />
    </div>
  </section>
</template>
