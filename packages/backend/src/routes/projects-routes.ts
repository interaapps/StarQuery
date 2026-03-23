import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'

export function registerProjectRoutes(app: Express, context: AppContext) {
  app.get('/api/projects', async (_req, res) => {
    res.json(await context.metaStore.listProjects())
  })

  app.post('/api/projects', async (req, res) => {
    const { name, slug, description } = req.body as {
      name?: string
      slug?: string
      description?: string | null
    }

    if (!name?.trim()) {
      res.status(400).json({ error: 'Project name is required' })
      return
    }

    const projects = await context.metaStore.listProjects()
    const project = await context.metaStore.createProject({
      name: name.trim(),
      slug: slug?.trim(),
      description: description?.trim() || null,
      position: projects.length,
    })

    res.status(201).json(project)
  })

  app.put('/api/projects/:projectId', async (req, res) => {
    const existing = await context.metaStore.getProjectById(req.params.projectId)
    if (!existing) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const { name, slug, description } = req.body as {
      name?: string
      slug?: string
      description?: string | null
    }

    if (!name?.trim()) {
      res.status(400).json({ error: 'Project name is required' })
      return
    }

    const project = await context.metaStore.updateProject(existing.id, {
      name: name.trim(),
      slug: slug?.trim() || existing.slug,
      description: description?.trim() || null,
    })

    res.json(project)
  })

  app.delete('/api/projects/:projectId', async (req, res) => {
    const existing = await context.metaStore.getProjectById(req.params.projectId)
    if (!existing) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await context.metaStore.deleteProject(existing.id)
    res.json({ ok: true })
  })
}
