<script setup lang="ts">
import InstallNavButton from "./InstallNavButton.vue";
</script>
<template>
  <div class="flex flex-col items-center py-20 lg:py-30">
    <div class="flex flex-col gap-10 items-center relative z-10">
      <h1 class="text-primary-500 font-extrabold !text-5xl lg:!text-7xl text-center">
        Data management, <br> made tasteful.
      </h1>

      <InstallNavButton large />
    </div>

    <div class="relative w-full -mt-20 -mb-40">
    <div class="flex flex-col items-center select-none pointer-events-none">
      <div
        class="relative animate-[spin_60s_linear_infinite] select-none opacity-20 hidden dark:block w-full"
      >
        <img
          src="/logo-part-outline.svg"
          class="h-full w-full relative"
          style="animation: first-star 10s; transform: rotate(106deg)"
        />
        <img
          src="/logo-part-outline.svg"
          class="h-full w-full absolute top-0"
          style="animation: second-star 10s"
        />
      </div>
      <div
        class="relative animate-[spin_60s_linear_infinite] select-none opacity-20 block dark:hidden w-full"
      >
        <img
          src="/logo-part-outline-dark.svg"
          class="h-full w-full relative"
          style="animation: first-star 10s; transform: rotate(106deg)"
        />
        <img
          src="/logo-part-outline-dark.svg"
          class="h-full w-full absolute top-0"
          style="animation: second-star 10s"
        />
      </div>
    </div>

      <div class="absolute h-full w-full flex items-center justify-center top-0">
        <img class="!hidden !dark:block w-full !max-w-100%" src="/screenshot.png" />
        <img class="!block !dark:hidden w-full !max-w-100%" src="/screenshot-light.png" />
      </div>


    </div>
  </div>
</template>
