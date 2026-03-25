import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'StarQuery',
  description: 'Tasteful data tools. Serious control.',
  cleanUrls: true,
  lastUpdated: true,
  vite: {
    plugins: [tailwindcss()],
  },
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#d63472' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'StarQuery',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Deployment', link: '/deploy/docker' },
      { text: 'Desktop', link: '/guide/electron' },
      { text: 'Reference', link: '/reference/configuration' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Runtime Modes', link: '/guide/runtime-modes' },
            { text: 'Datasources', link: '/guide/datasources' },
            { text: 'Electron Desktop', link: '/guide/electron' },
            { text: 'Development', link: '/guide/development' },
          ],
        },
      ],
      '/deploy/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Docker', link: '/deploy/docker' },
            { text: 'Hosted Configuration', link: '/deploy/hosted-configuration' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Configuration', link: '/reference/configuration' },
            { text: 'Permissions', link: '/reference/permissions' },
            { text: 'Exports', link: '/reference/exports' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
    },
    footer: {
      message: 'Tasteful data tools. Serious control.',
      copyright: 'Copyright © StarQuery',
    },
  },
})
