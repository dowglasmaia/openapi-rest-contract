# openapi-rest-contract — como usar com uma IA

Skill que **cria e atualiza o contrato OpenAPI 3.1 (Swagger) de uma API REST**, um contrato por módulo, em um projeto Java Spring Boot. Ela escreve **só o contrato** (e a configuração do gerador no `pom.xml`); controllers, casos de uso e persistência ficam para a skill `java-spring-create-module`. Você pede a uma ferramenta de IA (Claude Code, Codex, Copilot etc.), recebe uma **prévia** do que será criado e só depois de **aprovar** os arquivos são gerados. As instruções que a IA segue estão em [SKILL.md](SKILL.md).

## 1. Fluxo em quatro passos

1. **Pedido:** você descreve o módulo e os endpoints (use os modelos da seção 5).
2. **Análise (somente leitura):** a IA inspeciona o projeto e os contratos existentes. Nada é criado.
3. **Prévia:** a IA mostra uma proposta com endpoints, parâmetros, payloads, respostas, segurança e arquivos afetados, e pergunta: *aprova, quer alterações ou cancela?*
4. **Geração:** só após um "Aprovado" explícito a IA cria os arquivos, valida o contrato e roda a geração do Maven.

Qualquer mudança depois da aprovação exige nova prévia e nova aprovação. Cancelar não deixa nenhum arquivo para trás.

## 2. Para que serve (e para que não serve)

| Faz | Não faz |
|---|---|
| Cria o contrato de um **módulo novo** em `src/main/resources/openapi/modules/<modulo>.yaml` | Criar controllers, casos de uso ou banco (use `java-spring-create-module`) |
| Adiciona **recurso ou endpoint** a um módulo existente | Criar o projeto (use `java-spring-scaffold`) |
| Atualiza uma operação existente (com `replace`) | Inventar campos, regras, erros ou segurança que você não informou |
| Reaproveita os erros padronizados de `openapi/common/responses.yaml` | Duplicar `ProblemDetail` ou respostas de erro dentro do módulo |
| Configura uma execução do OpenAPI Generator por contrato no `pom.xml` (`interfaceOnly`, pacotes isolados) | Alterar contratos de outros módulos |
| Valida YAML, OpenAPI 3.1, `$ref`, `operationId` e rotas duplicadas | Migrar contratos legados sem pedido |

## 3. Pré-requisitos

- **Projeto Java Spring Boot com Maven** (de preferência criado pela `java-spring-scaffold`, que já traz o gerador configurado e `openapi/common/`).
- **Node.js 20.19+ ou 22.12+** e as dependências da skill: se a pasta `node_modules` não existir, rode `npm ci` dentro da pasta da skill.
- JDK do projeto e `JAVA_HOME` configurado; use o `mvnw` do projeto (`.\mvnw.cmd` no Windows).
- Pacote base Java do projeto (a IA lê do projeto; só pergunta se não for confiável).

## 4. Como apontar o projeto

- **Abra a ferramenta de IA na pasta do projeto** (a que contém o `pom.xml`, por exemplo `api-finance-controller/`), ou
- escreva no pedido: `Projeto: C:\projetos\meu-monorepo\api-finance-controller`.

Se a IA estiver na raiz de um monorepo e você não disser o caminho, ela deve perguntar qual pasta usar.

## 5. Informações que você deve passar

**Obrigatórias para começar:** método HTTP, caminho, finalidade e módulo responsável. O que não for informado fica como "não informado" na prévia, e a IA **não inventa** (nem campos obrigatórios, nem formatos, nem erros, nem segurança).

| Informação | Obrigatória | Observação |
|---|---|---|
| Projeto | Se a IA não estiver nele | Pasta com o `pom.xml` |
| Módulo responsável | **Sim** | Nome em minúsculas, ex.: `categorias`. A IA nunca cria módulo só pelo nome de um endpoint |
| Situação do módulo | Recomendado | novo, existente ou "não sei" (a IA verifica) |
| API (título e versão) | Só se o módulo for novo | Ex.: `Categorias API`, `1.0.0`; ou "usar dados do projeto" |
| Método HTTP | **Sim** | GET, POST, PUT, PATCH, DELETE ou HEAD |
| Caminho | **Sim** | Ex.: `/categorias/{categoriaId}`. Parâmetro entre chaves vira path parameter obrigatório |
| Finalidade | **Sim** | O que a operação faz |
| Parâmetros | Se houver | Nome, local (`query`, `header`, `path`, `cookie`), tipo e obrigatoriedade |
| Corpo da requisição | Se houver | Exemplo JSON e quais campos são obrigatórios (a IA não deduz obrigatoriedade de um exemplo) |
| Respostas | Recomendado | Status de sucesso, significado e exemplo JSON |
| Erros padronizados | Recomendado | Quais se aplicam: 400, 401, 403, 404, 409, 429, 500, 502 |
| Segurança | Se houver | Esquema e escopo; sem isso, "não definida" |

### Modelo geral (copie, preencha e envie)

```text
Use a skill openapi-rest-contract.

Projeto: [caminho ou "projeto atual"]
Módulo responsável: [ex.: categorias]
Situação do módulo: [novo / existente / não sei]
API, se o módulo for novo: [título e versão; ou "usar dados do projeto"]

Operação 1
Método HTTP: [GET | POST | PUT | PATCH | DELETE | HEAD]
Caminho: [ex.: /categorias/{categoriaId}]
Finalidade: [o que a operação faz]
Parâmetros: [nome, local, tipo, obrigatoriedade; ou "nenhum"]
Corpo da requisição: [exemplo JSON; ou "sem corpo"]
Respostas: [status, significado e exemplo JSON]
Erros padronizados: [ex.: 400, 404; ou "não informado"]
Campos obrigatórios e regras: [detalhes; ou "não informado"]
Segurança: [detalhes; ou "não informado"]

Outras operações: [repita o bloco Operação 1]
```

Se você enviar só `$openapi-rest-contract` sem detalhes, a IA mostra este modelo (versão em [references/request-template.md](references/request-template.md)). Você também pode pedir em prosa; a IA converte.

## 6. Como acionar

**Claude Code:** coloque a pasta da skill em `~/.claude/skills/openapi-rest-contract` (ou em `.claude/skills/` do repositório), abra o Claude Code na pasta do projeto e envie `/openapi-rest-contract` seguido do pedido.
**Codex:** a skill está em `~/.codex/skills/openapi-rest-contract`. Cite `$openapi-rest-contract` no pedido.
**Copilot (Agent mode) e outras ferramentas:** dê o caminho e peça para seguir as instruções:

```text
Leia C:\Users\dowgl\.codex\skills\openapi-rest-contract\SKILL.md e siga as instruções
para criar o contrato do módulo "categorias" neste projeto.
```

A ferramenta precisa ler arquivos, escrever arquivos (após a aprovação) e executar `node` e `mvnw` no terminal.

## 7. Modelos prontos por verbo HTTP

Os valores entre colchetes são exemplos. Os pedidos abaixo usam o módulo `categorias`; troque pelo seu. A coluna "Status típico" é uma sugestão da convenção REST: a IA só usa o que você informar ou aprovar na prévia.

| Verbo | Uso | Corpo da requisição | Status típico de sucesso |
|---|---|---|---|
| GET (um recurso) | Buscar por identificador | não | 200 |
| GET (lista) | Listar com filtros e paginação | não | 200 |
| POST | Criar | sim | 201 (ou 200 se não criar recurso) |
| PUT | Substituir o recurso inteiro | sim, completo | 200 ou 204 |
| PATCH | Alterar campos específicos | sim, parcial | 200 |
| DELETE | Remover | não | 204 |
| HEAD | Consultar só metadados | não | 200 |

GET e HEAD nunca têm corpo; HEAD e 204 não têm conteúdo na resposta.

### 7.1 GET: buscar um recurso

```text
Módulo responsável: categorias
Método HTTP: GET
Caminho: /categorias/{categoriaId}
Finalidade: buscar uma categoria pelo identificador
Parâmetros: categoriaId, path, inteiro, obrigatório
Corpo da requisição: sem corpo
Respostas: 200 categoria encontrada, exemplo {"id": 1, "nome": "Moradia", "tipo": "DESPESA"}
Erros padronizados: 401, 404
Segurança: não informado
```

### 7.2 GET: listar com filtros e paginação

```text
Módulo responsável: categorias
Método HTTP: GET
Caminho: /categorias
Finalidade: listar categorias com filtro por tipo e paginação
Parâmetros: tipo, query, texto, opcional; pagina, query, inteiro, opcional; tamanho, query, inteiro, opcional
Corpo da requisição: sem corpo
Respostas: 200 lista, exemplo {"itens": [{"id": 1, "nome": "Moradia", "tipo": "DESPESA"}], "total": 1}
Erros padronizados: 400, 401
Campos obrigatórios e regras: valores permitidos de tipo e limites de tamanho: [informe, ou "não informado"]
```

### 7.3 POST: criar

```text
Módulo responsável: categorias
Método HTTP: POST
Caminho: /categorias
Finalidade: criar uma categoria
Parâmetros: nenhum
Corpo da requisição: {"nome": "Moradia", "tipo": "DESPESA"}; obrigatórios: nome, tipo
Respostas: 201 categoria criada, exemplo {"id": 1, "nome": "Moradia", "tipo": "DESPESA"}
Erros padronizados: 400, 401, 409
Campos obrigatórios e regras: nome único por usuário (409 se repetir)
```

### 7.4 PUT: substituir o recurso inteiro

```text
Módulo responsável: categorias
Método HTTP: PUT
Caminho: /categorias/{categoriaId}
Finalidade: substituir todos os dados de uma categoria
Parâmetros: categoriaId, path, inteiro, obrigatório
Corpo da requisição: {"nome": "Moradia e contas", "tipo": "DESPESA"}; obrigatórios: nome, tipo
Respostas: 200 categoria substituída, exemplo {"id": 1, "nome": "Moradia e contas", "tipo": "DESPESA"}
Erros padronizados: 400, 401, 404, 409
```

### 7.5 PATCH: alterar campos específicos

```text
Módulo responsável: categorias
Método HTTP: PATCH
Caminho: /categorias/{categoriaId}
Finalidade: alterar apenas o nome da categoria
Parâmetros: categoriaId, path, inteiro, obrigatório
Corpo da requisição: {"nome": "Casa"}; nenhum campo obrigatório, mas ao menos um deve ser enviado
Respostas: 200 categoria atualizada, exemplo {"id": 1, "nome": "Casa", "tipo": "DESPESA"}
Erros padronizados: 400, 401, 404, 409
```

PATCH e PUT têm schemas de requisição **diferentes** quando os campos diferem; a IA não descreve PATCH como substituição completa.

### 7.6 DELETE: remover

```text
Módulo responsável: categorias
Método HTTP: DELETE
Caminho: /categorias/{categoriaId}
Finalidade: excluir uma categoria
Parâmetros: categoriaId, path, inteiro, obrigatório
Corpo da requisição: sem corpo
Respostas: 204 categoria excluída, sem corpo
Erros padronizados: 401, 404, 409
Campos obrigatórios e regras: categoria em uso por lançamentos não pode ser excluída (409)
```

### 7.7 HEAD: consultar metadados

```text
Módulo responsável: categorias
Método HTTP: HEAD
Caminho: /categorias/{categoriaId}
Finalidade: verificar se a categoria existe sem receber o corpo
Parâmetros: categoriaId, path, inteiro, obrigatório
Corpo da requisição: sem corpo
Respostas: 200 categoria existe, sem corpo
Erros padronizados: 404
```

### 7.8 Módulo novo com várias operações

```text
Projeto: projeto atual
Módulo responsável: categorias
Situação do módulo: novo
API, se o módulo for novo: Categorias API, versão 1.0.0

Operação 1: POST /categorias (criar), conforme 7.3
Operação 2: GET /categorias (listar), conforme 7.2
Operação 3: GET /categorias/{categoriaId} (buscar), conforme 7.1
```

### 7.9 Alterar uma operação existente

```text
Módulo responsável: categorias
Situação do módulo: existente
Operação a alterar: POST /categorias (operationId createCategoria)
Mudança: adicionar o campo opcional "cor" (texto) ao corpo e à resposta 201
```

A IA muda só os campos aprovados e avalia o efeito em schemas compartilhados.

## 8. O que você recebe na prévia

Antes de criar qualquer arquivo, a IA entrega uma proposta no formato de [references/approval-preview.md](references/approval-preview.md), com:

- módulo, caminho do contrato e se é criação ou atualização;
- tabela de endpoints (método, caminho, `operationId`, resumo, descrição, tags);
- parâmetros, payloads, schemas e respostas por status, com as referências aos erros comuns;
- segurança (ou "não definida");
- arquivos a criar e alterar, a execução do Maven e os pacotes gerados;
- pendências que ainda precisam da sua decisão.

Responda com **Aprovado**, **Pode gerar** ou **Confirmo** para a IA gerar, peça alterações, ou **Cancelar**. Silêncio ou resposta ambígua não contam como aprovação.

## 9. O que é gerado

```text
src/main/resources/openapi/
  modules/<modulo>.yaml        contrato do módulo (endpoints, parâmetros, schemas de negócio, sucesso)
  common/responses.yaml        ProblemDetail e respostas de erro padronizadas (compartilhado)
  common/security.yaml         só se você definir segurança
pom.xml                        uma execução do openapi-generator-maven-plugin por contrato
```

As interfaces e DTOs Java saem em `target/generated-sources/openapi/<modulo>` (pacotes `...generated.<modulo>.api` e `...model`); não edite essa pasta. O controller é feito depois com a skill `java-spring-create-module`.

Depois de gerar, a IA valida cada contrato (YAML, OpenAPI 3.1, `$ref`, `operationId` e rotas duplicadas), roda a geração do Maven e, se o ambiente permitir, `mvnw clean verify`. O que não puder rodar é informado, nunca declarado como sucesso.

## 10. Próximo passo

Com o contrato aprovado e gerado, use a skill `java-spring-create-module` para implementar o módulo (veja o README dela).

## 11. Erros comuns

| Sintoma | Causa e solução |
|---|---|
| A IA mostra o modelo em vez de analisar | O pedido não trouxe detalhes concretos; preencha o modelo da seção 5 |
| A IA pergunta o módulo responsável | Ela não cria módulo só pelo nome do endpoint; informe o módulo |
| Nada foi criado após enviar o pedido | Esperado: falta a sua aprovação da prévia |
| `Cannot find module` ao rodar a skill | Rode `npm ci` na pasta da skill |
| `mvn` não reconhecido | Use `.\mvnw.cmd` (o projeto usa Maven Wrapper) |
| Erro de `operationId` duplicado | Os `operationId` são únicos entre todos os contratos; escolha outro nome |
