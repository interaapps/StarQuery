# Backend spec


## Organizations `Coming soon`
### `GET` /api/organizations

## Projects
### `GET` /api/organizations/:organization/projects
### `POST` /api/organizations/:organization/projects
### `GET` /api/organizations/:organization/projects/:name
### `PUT` /api/organizations/:organization/projects/:name

## Sources
### `GET`  /api/organizations/:organization/projects/:name/sources

```json
{
  "data": [
    {
      "name": "starquery",
      "type": "sql",
      "driver": "mysql"
    }
  ]
}
```
### `POST` /api/organizations/:organization/projects/:name/sources

## Source
### `WS` /api/organizations/:organization/projects/:name/sources:source/sql
