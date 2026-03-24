import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import type { Express } from 'express'
import type { AppConfig } from './config/app-config.ts'

function resolveFrontendFiles(config: AppConfig) {
  if (!config.frontendDistPath?.trim()) {
    return null
  }

  const distPath = path.resolve(config.frontendDistPath)
  const indexPath = path.join(distPath, 'index.html')
  if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
    return null
  }

  return {
    distPath,
    indexPath,
  }
}

export function registerStaticFrontend(app: Express, config: AppConfig) {
  const frontendFiles = resolveFrontendFiles(config)
  if (!frontendFiles) {
    return false
  }

  app.use(
    express.static(frontendFiles.distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (!filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    }),
  )

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendFiles.indexPath)
  })

  return true
}
