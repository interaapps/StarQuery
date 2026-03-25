import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import InstallNavButton from './components/InstallNavButton.vue'
import GitHubStarButton from './components/GitHubStarButton.vue'
import HomeScreenshotShowcase from './components/HomeScreenshotShowcase.vue'
import './custom.css'
import HomeHero from "./components/HomeHero.vue";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () =>
        h('div', { class: 'hidden md:flex md:items-center md:gap-3' }, [
          h(GitHubStarButton),
          h(InstallNavButton),
        ]),
    }),
  enhanceApp({ app }) {
    app.component('HomeScreenshotShowcase', HomeScreenshotShowcase)
    app.component('HomeHero', HomeHero)
  },
} satisfies Theme
