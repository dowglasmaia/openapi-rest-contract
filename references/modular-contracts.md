# Contratos por módulo e Maven

Todas as decisões desta referência devem constar da [prévia para aprovação](approval-preview.md) quando aplicáveis. Até a aprovação explícita, inspecione contratos e pom.xml somente por leitura; depois gere apenas os arquivos e configurações aprovados.

## Decisão

| Solicitação | Contrato | Maven |
|---|---|---|
| Novo módulo Invoice, identificado explicitamente | Criar modules/invoice.yaml | Adicionar generate-invoice-api |
| POST /invoices no Invoice existente | Atualizar modules/invoice.yaml | Reutilizar execution |
| GET /payments/{id} no Payment existente | Atualizar modules/payment.yaml | Reutilizar execution |
| Estorno de pagamento no Payment | Atualizar modules/payment.yaml | Reutilizar execution |
| Alterar response do GET Customer | Atualizar modules/customer.yaml | Reutilizar execution |
| Endpoint sem módulo identificável | Perguntar módulo | Não alterar |

Recurso e endpoint não definem automaticamente um módulo. Inspecione contratos, packages, código e pom.xml. Antes de criar, procure uma implementação ou operação equivalente. Um contrato deve conter somente operações do seu módulo e pode usar componentes locais ou $ref externos resolvíveis. Não crie um arquivo consolidado. Ao atualizar esquema compartilhado, examine todas as operações que o referenciam e preserve compatibilidade quando possível.

```text
src/main/resources/openapi/
├── modules/
│   ├── customer.yaml
│   ├── payment.yaml
│   └── account.yaml
└── common/
    ├── responses.yaml
    └── security.yaml  # somente quando existir esquema de segurança compartilhado
```

common/responses.yaml contém no mesmo fragmento components.schemas.ProblemDetail, o schema auxiliar FieldViolation e components.responses com BadRequestResponse, UnauthorizedResponse, ForbiddenResponse, NotFoundResponse, ConflictResponse, TooManyRequestsResponse, BadGatewayResponse e InternalServerErrorResponse. Cada resposta usa application/problem+json e $ref interno #/components/schemas/ProblemDetail; o schema ProblemDetail usa #/components/schemas/FieldViolation. Em modules/<module>.yaml, uma resposta padronizada usa $ref: '../common/responses.yaml#/components/responses/BadRequestResponse' (ajuste o nome). Os módulos mantêm endpoints, parameters, schemas de negócio e responses de sucesso. Não crie problem-detail.yaml nem um arquivo por status. A biblioteca de erros não autoriza adicionar automaticamente todos os status a cada operação. common/security.yaml é separado por responsabilidade quando existir segurança especificada; um módulo pode referenciar ../common/security.yaml#/components/securitySchemes/<SchemeName> em components.securitySchemes e usar o nome local em security. Não invente um esquema.

## Nova execution

O gerador modular acrescenta uma única execution ao plugin org.openapitools:openapi-generator-maven-plugin existente, ou cria o plugin se ausente. O ID é generate-<module>-api; inputSpec aponta a src/main/resources/openapi/modules/<module>.yaml; output a target/generated-sources/openapi/<module>; apiPackage e modelPackage usam <basePackage>.generated.<module>.api e .model. Usa spring, spring-boot, interfaceOnly=true, skipDefaultInterface=true, Java/Jakarta compatível com Spring Boot 3 ou 4 e fase generate-sources. Quando a API não tiver a dependência de validação necessária ao código gerado, adiciona spring-boot-starter-validation uma vez. O contrato existente conserva sua execution. Se o pom.xml usar organização não suportada pelo script, edite conservadoramente em vez de forçar uma transformação.

## Verificação

Valide sintaxe YAML, OpenAPI 3.1 e $ref de todos os contratos. Verifique ausência de método/caminho e operationId repetidos entre contratos. Confira estrutura XML, IDs e inputSpecs no pom.xml; execute mvn generate-sources, confira os packages por módulo, e mvn clean verify quando possível. Informe os comandos executados e qualquer limitação concreta. Repetir a mesma solicitação não deve mudar os arquivos.
