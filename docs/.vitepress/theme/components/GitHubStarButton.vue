<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type GithubRepository = {
  stargazers_count?: number
}

const repoUrl = 'https://github.com/interaapps/starquery'
const repoApiUrl = 'https://api.github.com/repos/interaapps/starquery'
const starCount = ref<number | null>(null)

const label = computed(() => {
  if (typeof starCount.value !== 'number') {
    return 'Star on GitHub'
  }

  return `Star on GitHub · ${new Intl.NumberFormat().format(starCount.value)}`
})

onMounted(async () => {
  try {
    const response = await fetch(repoApiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      return
    }

    const repository = (await response.json()) as GithubRepository
    starCount.value =
      typeof repository.stargazers_count === 'number' ? repository.stargazers_count : null
  } catch {
    starCount.value = null
  }
})
</script>

<template>
  <a
    :href="repoUrl"
    class="hidden whitespace-nowrap rounded-full border border-[var(--vp-c-border)] bg-[var(--vp-c-bg)] px-4 py-[0.3rem] text-[0.92rem] font-semibold tracking-[-0.01em] text-[var(--vp-c-default-1)] no-underline transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-200 md:inline-flex md:items-center md:justify-center"
    target="_blank"
    rel="noreferrer"
  >
    {{ label }}
  </a>
</template>
