---
name: openapi-rest-contract
description: Preview and, after explicit developer approval, create or update OpenAPI 3.1 contracts by module under src/main/resources/openapi/modules with shared errors in openapi/common and isolated Maven Generator executions. Show a copy-and-fill request template when details are missing. Preserve legacy contracts.
---

# OpenAPI REST contract

Author the contract, not controllers, services, persistence, or business logic. One application module has one independent OpenAPI 3.1 contract. Node.js 20.19+ or 22.12+ and this skill's package-lock.json dependencies are required (npm ci in the skill directory if node_modules is absent).

## Intake and read-only analysis

If the invocation lacks a concrete request, show the copy-and-fill [request template](references/request-template.md) and ask the developer to send it back. Do not create files from example values. If partly specified, prefill known facts and ask only for essential gaps. The developer may describe the request in prose; convert it to generator JSON yourself **after approval**. Never infer a new module solely from an endpoint or resource name.

Before proposing changes, inspect the project tree, module/package organization, existing contracts and equivalent operations, common components, and the OpenAPI Generator configuration in pom.xml. Determine whether the request creates a module, a resource, an endpoint, or changes an existing endpoint. Prefer the developer's explicit module and actual project organization. If ownership or another essential detail remains uncertain, ask before preparing the final proposal. Do not invent endpoints, payloads, required fields, security, or business rules.

Analysis and proposal preparation are **read only**. Do not create a temporary JSON input, contract, bundle, directory, or other file; do not edit or remove any project file; and do not modify pom.xml before approval. An initial detailed request, prior approvals for other proposals, silence, or an ambiguous reply does not approve the proposal.

## Preview → review → approval

Present a concise, structured proposal using [the approval preview](references/approval-preview.md). Include the module, contract path and create/update decision; every endpoint's method, path, operationId, summary, description, and tags; applicable parameters and their types/required status; request and response bodies, schemas, property types and explicitly defined required fields; success and applicable error statuses with common response references; security when applicable; and the exact files and Maven executions/packages affected. Mark genuinely unresolved details as pending. Do not display full YAML unless requested.

Then stop and ask for **explicit approval of this proposal**. The developer can approve, request changes, or cancel. On requested changes, revise and present the complete updated proposal for approval again. Any change to endpoints, schemas, parameters, responses, security, affected files, or Maven configuration after approval needs a revised proposal and new approval. One approval covers all files clearly listed in that proposal. If the developer cancels, stop without project mutations.

## Generation after approval

Proceed only when the developer explicitly approves the latest complete proposal and no essential details remain unresolved. Generate exactly the approved scope. Read [contract conventions](references/contract-conventions.md), [modular contracts](references/modular-contracts.md), and [input format](references/input-format.md) as relevant.

For a clearly new module, create src/main/resources/openapi/modules/<module>.yaml with only its endpoints, parameters, business schemas, and success responses. Use src/main/resources/openapi/common/responses.yaml for standardized errors; it contains components.schemas.ProblemDetail and components.responses together. Module errors reference ../common/responses.yaml#/components/responses/<ResponseName>; internal references in that fragment target #/components/schemas/ProblemDetail. Never split ProblemDetail or individual status responses into separate files or copy them into modules. Put shared security in common/security.yaml only when a scheme is specified. Add one independent openapi-generator-maven-plugin execution for the new contract, with a deterministic ID, module-specific API/model packages and output, spring, interfaceOnly=true, and generate-sources. Preserve existing contracts and unrelated Maven configuration.

For a resource or endpoint in an existing module, update that module's contract and reuse its Maven execution. For an existing operation, change only the approved fields and assess shared-schema effects. Preserve the older single-entry layout (openapi/openapi.yaml, paths/, components/) and older root-level module contracts when continuing them; do not silently migrate or create a second contract.

Only now write a temporary JSON configuration, run node <skill>/scripts/module-scaffold.mjs --project <project-root> --config <input.json> for the modular layout, and remove the temporary input afterward. Use sharedResponse for approved standardized errors; do not add unapproved status codes. Use replace: true for an approved operation update. For the legacy layout, use scripts/scaffold.mjs. For another established layout, edit conservatively in place.

After generation, validate every affected OpenAPI entry with scripts/validate.mjs, YAML syntax, OpenAPI 3.1, external $ref resolution, and duplicate route/operationId checks across contracts. Bundle only where needed; the legacy generator produces openapi.bundle.yaml. Verify pom.xml structure and 4-space indentation of new XML blocks; run Maven OpenAPI generation, inspect isolated packages, and run mvn clean verify when the environment permits. Confirm previous contracts still work. Fix failures within the approved scope; request a new approval before changes outside it. Report any check that could not run.

Use the official [OpenAPI 3.1 specification](https://swagger.io/specification/v3.1/) for semantics not covered in the references. Do not modify the Java Spring scaffold skill.
