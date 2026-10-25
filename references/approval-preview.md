# Prévia obrigatória para aprovação

Prepare esta prévia após inspeção somente de leitura. Ela deve corresponder exatamente ao conjunto de arquivos e decisões que serão implementados. Não escreva YAML completo salvo pedido explícito do desenvolvedor.

## Estrutura da proposta

### Proposta de contrato — <módulo>

**Projeto:** <nome/caminho>
**Operação:** novo módulo, novo recurso, novo endpoint ou atualização
**Contrato:** <caminho absoluto ou relativo ao projeto, indicando criação ou atualização>
**OpenAPI info:** <title e version, quando novo>

**Endpoints:**

| Método | Path | operationId | Summary | Descrição | Tags |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

**Parâmetros:** por endpoint, informar path/query/header/cookie, nome, tipo e obrigatoriedade; escrever “nenhum” quando não houver.

**Payloads e schemas:** por endpoint, informar request body (inclusive media type e obrigatoriedade do corpo), response body por status, nomes de schemas, propriedades e tipos. Marcar obrigatoriedade de propriedades apenas quando definida pelo pedido ou contrato existente. Declarar claramente o que permanece não especificado; não inventar formatos, limites ou regras.

**Respostas HTTP:** por endpoint, listar status de sucesso e erro aplicáveis, descrições e referências propostas a common/responses.yaml#/components/responses/<ResponseName>. A existência de uma resposta compartilhada não significa que todo endpoint a utiliza.

**Segurança:** esquema e requisito por operação quando especificados; caso contrário, “não definida”.

**Impacto no projeto:** listar cada arquivo a criar e alterar, incluindo contrato, common/responses.yaml se necessário, common/security.yaml quando aplicável, pom.xml e qualquer dependência relacionada à geração. Para Maven, indicar execution ID, inputSpec, diretório de saída e packages de API/modelos. Mencionar explicitamente quando uma execução existente será reutilizada.

**Pendências:** somente informações essenciais ainda não resolvidas. Resolva-as antes de pedir aprovação final.

Termine perguntando: “Você aprova esta proposta, deseja alterações ou quer cancelar?” Pare e aguarde a resposta. Aprovação explícita como “Aprovado”, “Pode gerar”, “Confirmo” ou “Implementar conforme apresentado” vale somente para a última proposta completa. Se houver correção de qualquer item material, apresente uma nova versão e aguarde outra aprovação.

## Exemplo de prévia curta

### Proposta de contrato — Payment

**Projeto:** aplicação atual
**Operação:** novo módulo
**Contrato:** criar src/main/resources/openapi/modules/payment.yaml
**OpenAPI info:** Payment API, versão do projeto

**Endpoint:** POST /payments; operationId createPayment; summary “Criar pagamento”; descrição “Cria um pagamento”; tag payment.

**Parâmetros:** nenhum.
**Payload:** request body application/json; propriedades e obrigatoriedade ainda não definidas.
**Respostas:** 201 Created sem corpo definido; erros aplicáveis pendentes de regras.
**Segurança:** não definida.
**Impacto:** criar modules/payment.yaml e common/responses.yaml caso ainda ausente; alterar pom.xml com generate-payment-api, inputSpec do módulo, saída target/generated-sources/openapi/payment e packages <basePackage>.generated.payment.api/model. Nenhum outro contrato será alterado.
**Pendências:** informar o payload necessário e os erros aplicáveis para uma proposta final.

Neste exemplo, peça os detalhes pendentes antes de solicitar aprovação. Após recebê-los, apresente a proposta completa e aguarde aprovação explícita.
