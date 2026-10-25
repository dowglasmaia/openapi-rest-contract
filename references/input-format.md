# Formato interno do gerador

O desenvolvedor pode responder em linguagem natural ou pelo [modelo](request-template.md). Primeiro o agente prepara e apresenta a [prévia para aprovação](approval-preview.md) apenas com leitura do projeto. Somente após aprovação explícita da última proposta completa transforma o pedido em JSON temporário e passa --project separadamente, sem pedir JSON ao desenvolvedor. Não crie o JSON nem qualquer outro arquivo durante a análise.

Exemplos completos: [módulo novo](../examples/modular-payment.json) e [operações no formato legado](../examples/operations.json).

## Contrato por módulo (padrão)

```json
{
  "module": "payment",
  "mode": "new-module",
  "basePackage": "com.example.service.api",
  "info": { "title": "Payment API", "version": "1.0.0" },
  "operations": [
    {
      "profile": "payment",
      "method": "POST",
      "path": "/payments",
      "operationId": "createPayment",
      "summary": "Create a payment",
      "requestBody": {
        "required": true,
        "schema": { "type": "object", "properties": { "amount": { "type": "number" } } }
      },
      "responses": {
        "201": { "description": "Created", "schema": { "type": "object", "properties": { "id": { "type": "string" } } } },
        "400": { "sharedResponse": "BadRequestResponse" }
      }
    }
  ]
}
```

module is an explicit normalized module name; never derive it only from path or profile. mode is new-module or existing-module. A repeated new-module request for an already created contract is accepted as a no-op when content matches. basePackage is required for a new module and comes from the project's Java package. info.title and info.version are required for new modules. New entries go in openapi/modules/<module>.yaml, and Maven inputSpec points there. Older root-level module entries are reused in place. Existing modules retain their info and Maven execution. Run node <skill>/scripts/module-scaffold.mjs --project <root> --config <json>.

Each operation needs method, path, and summary. Supported methods: GET, POST, PUT, PATCH, DELETE, HEAD. Optional keys: operationId, description, tags, parameters, security, requestBody, responses, replace. responses can be omitted for a minimal success response. schema is preferred; example infers types but never required fields or business rules. A path parameter is inferred from braces. An existing operation with changed content needs replace: true. Each contract has local business request and success response schemas. For an explicitly documented standardized error, use a response object containing only sharedResponse with a name defined in common/responses.yaml. The generator emits a relative external $ref to #/components/responses/<ResponseName>. In new modular contracts, documented 400, 401, 403, 404, 409, 429, 502 and 500 responses must use their matching sharedResponse. Do not duplicate ProblemDetail or standard responses inside a module. Reuse an existing schema explicitly when appropriate; inspect shared-schema impacts before updates.

## Legacy single-entry contract

For a project already using openapi/openapi.yaml, omit module, mode, and basePackage; include profile on each operation and use scripts/scaffold.mjs. This keeps paths/<profile>.yaml, components/schemas/requests, components/schemas/responses, and the derived openapi.bundle.yaml. The existing behavior and schema rules remain available. New modular projects use the per-module format above.
