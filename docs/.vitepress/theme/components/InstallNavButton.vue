<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type PlatformTarget = 'macOS' | 'Windows' | 'Linux'

type GithubReleaseAsset = {
  name: string
  browser_download_url: string
}

type GithubLatestRelease = {
  html_url: string
  assets?: GithubReleaseAsset[]
}

const latestReleaseUrl = 'https://github.com/interaapps/starquery/releases/latest'
const githubLatestReleaseApi = 'https://api.github.com/repos/interaapps/starquery/releases/latest'
const platform = ref<PlatformTarget | null>(null)
const downloadUrl = ref(latestReleaseUrl)
const isLoading = ref(false)

defineProps<{
  large?: boolean
}>()

const label = computed(() => {
  if (!platform.value) {
    return 'Install'
  }

  return `Install for ${platform.value}`
})

function detectPlatform(): PlatformTarget | null {
  const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase()

  if (value.includes('mac')) {
    return 'macOS'
  }

  if (value.includes('win')) {
    return 'Windows'
  }

  if (value.includes('linux')) {
    return 'Linux'
  }

  return null
}

function getAssetMatchers(target: PlatformTarget) {
  if (target === 'macOS') {
    return [
      (name: string) => name.endsWith('.zip') && (name.includes('darwin') || name.includes('mac')),
      (name: string) => name.endsWith('.zip'),
    ]
  }

  if (target === 'Windows') {
    return [
      (name: string) => name.endsWith('.exe'),
      (name: string) => name.endsWith('.msix'),
      (name: string) => name.endsWith('.nupkg'),
    ]
  }

  return [
    (name: string) => name.endsWith('.deb'),
    (name: string) => name.endsWith('.rpm'),
    (name: string) => name.endsWith('.appimage'),
    (name: string) => name.endsWith('.tar.gz'),
  ]
}

function findBestAssetUrl(target: PlatformTarget, assets: GithubReleaseAsset[]) {
  const normalizedAssets = assets.map((asset) => ({
    ...asset,
    normalizedName: asset.name.toLowerCase(),
  }))

  for (const matcher of getAssetMatchers(target)) {
    const match = normalizedAssets.find((asset) => matcher(asset.normalizedName))
    if (match) {
      return match.browser_download_url
    }
  }

  return null
}

async function loadLatestReleaseAsset(target: PlatformTarget) {
  isLoading.value = true

  try {
    const response = await fetch(githubLatestReleaseApi, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      return
    }

    const release = (await response.json()) as GithubLatestRelease
    const assetUrl = findBestAssetUrl(target, release.assets ?? [])
    downloadUrl.value = assetUrl || release.html_url || latestReleaseUrl
  } catch {
    downloadUrl.value = latestReleaseUrl
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  const detectedPlatform = detectPlatform()
  platform.value = detectedPlatform

  if (detectedPlatform) {
    void loadLatestReleaseAsset(detectedPlatform)
  }
})
</script>

<template>
  <a
    :href="downloadUrl"
    class="whitespace-nowrap rounded-full border border-transparent bg-primary-500 hover:bg-primary-600 hover:scale-110 active:scale-95 transition-all text-[0.92rem] font-bold tracking-[-0.01em] !text-white !no-underline md:inline-flex md:items-center md:justify-center"
    :class="large ? '!text-xl py-3 px-8' : 'py-[0.3rem] px-4'"
    target="_blank"
    rel="noreferrer"
    :aria-busy="isLoading ? 'true' : 'false'"
  >
    {{ label }}
  </a>
</template>
