# Exports

StarQuery can export result data from the frontend in multiple formats.

## Supported Formats

- CSV
- JSON
- SQL inserts
- XML
- HTML table

## Notes

- JSON preserves structured JSON data where supported by the source view
- tabular text-based exports may serialize nested structures as strings
- exports are generated in the frontend for the current visible result set or draft-aware result model, depending on the view

## Typical Use Cases

- CSV for spreadsheets and ad-hoc sharing
- JSON for machine-readable exchange
- SQL inserts for seeding and fixture workflows
- XML and HTML table for compatibility-oriented exports
