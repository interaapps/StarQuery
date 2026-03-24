import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import AdminView from '../views/AdminView.vue'

function createAppHistory() {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return createWebHashHistory()
  }

  return createWebHistory(import.meta.env.BASE_URL)
}

const router = createRouter({
  history: createAppHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      meta: {
        hideSidebar: true,
      },
      component: LoginView,
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      meta: {
        hideSidebar: true,
      },
      component: OnboardingView,
    },
    {
      path: '/admin',
      name: 'admin',
      meta: {
        hideSidebar: true,
      },
      component: AdminView,
    },
  ],
})

export default router
