# Modelo para pedir um contrato OpenAPI

Ao receber apenas $openapi-rest-contract ou um pedido insuficiente, mostre este bloco para o desenvolvedor copiar, preencher e reenviar. Os valores entre colchetes são exemplos, não requisitos reais. Receber o formulário preenchido inicia a análise e a prévia; ainda não autoriza criar arquivos. A geração depende de aprovação explícita da proposta apresentada depois da análise.

```text
Projeto: [nome ou caminho; ou "projeto atual"]
Módulo responsável: [ex.: payment; ou "não sei"]
Situação do módulo: [novo / existente / não sei]
API, se o módulo for novo: [nome e versão; ou "usar dados do projeto"]
Recurso: [ex.: refunds]

Operação 1
Método HTTP: [GET, POST, PUT, PATCH, DELETE ou HEAD]
Caminho: [ex.: /payments/{paymentId}/refunds]
Finalidade: [o que a operação faz]
Parâmetros: [nome, local, tipo e obrigatoriedade; ou "nenhum"]
Corpo da requisição: [exemplo JSON; ou "sem corpo"]
Respostas: [código HTTP, significado e exemplo JSON; ou "sem corpo"]
Erros padronizados: [códigos aplicáveis, como 400 ou 404; ou "não informado"]
Campos obrigatórios e regras: [detalhes; ou "não informado"]
Segurança: [detalhes; ou "não informado"]

Outras operações: [repita o bloco Operação 1, se necessário]
```

Método, caminho, finalidade e módulo responsável bastam para começar a proposta. Se o módulo for desconhecido, analise o projeto; caso continue incerto, pergunte antes de apresentar a proposta final. Dados opcionais ausentes não autorizam inventar requisitos, formatos, segurança ou erros. Quando o desenvolvedor informar um erro padronizado, use a resposta compartilhada de common/responses.yaml. Um parâmetro {id} no caminho é obrigatório. Para um módulo novo, derive nome e versão da API do projeto quando confiáveis; pergunte se não forem. Após a prévia, o desenvolvedor pode aprovar, pedir alterações ou cancelar sem que qualquer arquivo do projeto tenha sido modificado.
