import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { SQLWebSocket } from '@/utils/connections/SQLWebSocket.ts'

export const useTabsStore = defineStore('counter', () => {
  const tabs = shallowRef([
    {
      name: 'pastefy_pastes',
      type: 'database/sql/mysql:table',
      data: {
        connection: {
          socket: new SQLWebSocket(
            'ws://localhost:3000/api/organizations/orga/projects/project/source/pastefy/sql',
          ),
        },
        defaultQuery: 'SELECT * FROM pastefy_pastes limit 100',
      },
    },
    {
      name: 'pastefy_users',
      type: 'database/sql/mysql:table',
      data: {
        connection: {
          socket: new SQLWebSocket(
            'ws://localhost:3000/api/organizations/orga/projects/project/source/pastefy/sql',
          ),
        },
        defaultQuery: 'SELECT * FROM pastefy_users limit 100',
      },
    },
    {
      name: 'pastefy_users',
      type: 'database/sql/mysql:query',
      data: {
        connection: {
          socket: new SQLWebSocket(
            'ws://localhost:3000/api/organizations/orga/projects/project/source/pastefy/sql',
          ),
        },
        defaultQuery: '',
      },
    },
  ])

  const currentTab = ref(0)

  return { tabs, currentTab }
})
