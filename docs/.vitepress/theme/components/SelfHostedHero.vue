<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useData } from 'vitepress'
import InstallNavButton from './InstallNavButton.vue'
import { codeToHtml } from 'shiki'

const { isDark } = useData()

const screenshotSrc = computed(() => (isDark.value ? '/screenshot-selfhosted.png' : '/screenshot-selfhosted-light.png'))
const logoOutlineSrc = computed(() =>
  isDark.value ? '/logo-part-outline.svg' : '/logo-part-outline-dark.svg',
)

const html = ref('')

watch(isDark, async () => {
  html.value = await codeToHtml(
    `docker run -d \\
  --name starquery \\
  -p 8080:8080 \\
  --add-host=host.docker.internal:host-gateway \\
  -v starquery-data:/var/lib/starquery \\
  --restart unless-stopped \\
  interaapps/starquery`,
    {
      lang: 'bash',
      theme: isDark.value ? 'github-dark' : 'github-light',
    },
  )
}, {immediate: true})

</script>
<template>
  <div class="flex flex-col items-center py-20 lg:py-30">
    <div class="flex flex-col gap-10 items-center relative z-10 w-full">
      <h1 class="text-primary-500 font-extrabold !text-5xl lg:!text-7xl text-center">
        Data management,
        with your team, <br>
        on your server,
        made tasteful.
      </h1>

      <div class="vp-doc in-vue-codeblock max-w-full" v-html="html" />
    </div>

    <div class="relative w-full -mt-20 -mb-40">
      <div class="flex flex-col items-center select-none pointer-events-none">
        <div
          class="relative animate-[spin_60s_linear_infinite] select-none opacity-20 w-full"
        >
          <img
            :src="logoOutlineSrc"
            class="h-full w-full relative"
            style="animation: first-star 10s; transform: rotate(106deg)"
          />
          <img
            :src="logoOutlineSrc"
            class="h-full w-full absolute top-0"
            style="animation: second-star 10s"
          />
        </div>
      </div>

      <div class="absolute h-full w-full flex items-center justify-center top-0">
        <img class="w-full !max-w-100%" :src="screenshotSrc" alt="StarQuery app screenshot" />
      </div>


    </div>
  </div>
</template>
