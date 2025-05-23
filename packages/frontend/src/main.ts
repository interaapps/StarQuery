import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { registerEventHandlers } from '@/utils/theme-logic.ts'
import { useConfig } from '@/composables/config.ts'
import axios from 'axios'
import { install as VueCodemirror } from 'vue-codemirror'

import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import ConfirmationService from 'primevue/confirmationservice'
import theme from '@/theme.ts'
import { SQLWebSocket } from '@/utils/connections/SQLWebSocket.ts'

// @ts-ignore
import vue3Shortkey from 'vue3-shortkey'
export const config = useConfig()
export const app = createApp(App)

export const client = axios.create({
  baseURL: (import.meta.env.VITE_APP_BASE_URL as string) || undefined,
})

const preset = definePreset(Aura, theme)
app.use(PrimeVue, {
  theme: {
    preset,
    options: {
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue',
      },
    },
  },
})
app.use(ToastService)
app.directive('tooltip', Tooltip)
app.use(ConfirmationService)
app.use(vue3Shortkey, { prevent: ['input', 'textarea'] })
app.use(VueCodemirror, {
  extensions: [],
})
app.use(createPinia())
app.use(router)

app.mount('#app')

registerEventHandlers()
