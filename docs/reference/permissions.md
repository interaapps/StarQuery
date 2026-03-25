# Permissions

StarQuery permissions are scoped around project management and datasource access.

## Datasource Permissions

Examples of datasource-oriented permissions:

- `project.manage.{projectId}.datasources`
- `project.manage.{projectId}.datasources.*`
- `project.manage.{projectId}.datasources.{sourceId}`

Read/write suffixes can be used as needed:

- `:read`
- `:write`

## Behavior Notes

- datasource read permissions allow query and data interaction flows
- datasource write permissions are required for datasource configuration changes
- configuration management and actual data manipulation are intentionally separated

## Project-Level Management

Project management permissions govern actions such as:

- managing users in a workspace/project
- managing datasource definitions
- changing project-scoped configuration

Use least privilege where possible, especially for hosted setups.
