# Operator starter kit

Public entry point: https://mcp.wearewarp.com/starter-kit

This is a customer-facing download and prompt library. It does not add a new MCP tool or create a hosted freight submission service.

## Contents

- `public/downloads/warp-shipment-intake.xlsx`: Instructions, Intake (50 blank rows), Results (100 blank option rows).
- `content/starter-prompts.json`: six customer prompts shared by the page and workbook builder.
- `components/starter-prompts.tsx`: task selection, readable prompt and copy control.
- `scripts/build-starter-workbook.mjs`: reproducible workbook source.

The workbook adapts the intake pattern supplied in customer feedback. It contains no customer locations, invoices, credentials or actual quote results. Origin locations are filled by each operator. Excel data validation checks format and numeric inputs; it does not establish ZIP existence, service eligibility or carrier capacity. Pasted values can bypass spreadsheet validation, so the prompt also asks the assistant to check the rows.

## Rebuild

Use Node and `@oai/artifact-tool` in an isolated artifact environment. Copy the builder into that environment with its `node_modules` linked to the artifact runtime, then run:

```sh
node build-starter-workbook.mjs /absolute/path/to/warp-mcp-remote /absolute/path/to/output
```

The builder reads the shared prompt JSON, exports the workbook, produces PNG previews and copies the final XLSX into `public/downloads`. Artifact tooling is not a production dependency. Review every worksheet preview and inspect the saved XLSX validation rules after rebuilding.

## Behavior and scope

- An assistant must read the uploaded sheet. The workbook itself performs no requests.
- Compare-all requests use the existing all-mode path per shipment. A batch of one-mode quotes must not be presented as an all-mode comparison.
- Carrier marketplace comparison is LTL only. FTL remains a Warp quote.
- Invoice review can use uploaded external-carrier records. Warp document tools only retrieve records accessible through the connected Warp account.
- Missing facts, estimated dates, quoted opportunities and documented outcomes remain distinct.
- These prompts request quote/review-only work. They are not an enforcement boundary or a substitute for client approval controls.
- Native Google Sheets, an embeddable intake form, automated file editing and recurring scheduling are not implemented by this kit.

## Verification, September 18, 2026

- Next production build and TypeScript checks passed.
- Browser checks passed for all six task selections and exact clipboard contents, successful XLSX download, no page errors and a 390px mobile viewport with no horizontal overflow.
- Workbook verified: three sheets, 50 blank input rows, no formula error cells, C7 freeze panes, ZIP text formats, input validation and a cross-sheet origin dropdown using INDIRECT.
- Visual checks: Instructions, both horizontal halves of Intake and Results, desktop and mobile page.
- Live MCP quote-only check: 90001 to 92101, September 21 pickup, two non-stackable 500 lb pallets of boxed apparel, 48 x 40 x 48 inches. Four modes returned and an LTL benchmark with 28 carriers. No booking or account-changing tools called.
- This live tool check is not an end-to-end test of every prompt inside every AI client. Invoice/service findings require the operator's documents and actual service evidence. Excel validation metadata was inspected; this is not a claim of interactive testing in every Excel version.
