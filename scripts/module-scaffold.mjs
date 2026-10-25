#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validate } from './validate.mjs';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);
const STATUS = { get: '200', post: '201', put: '200', patch: '200', delete: '204', head: '200' };
const asObject = value => value && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const camel = value => value.replace(/(^|[-_ ])([a-z0-9])/g, (_, _sep, char) => char.toUpperCase());
const ref = name => `#/components/schemas/${name}`;
const shiftIndent = (block, spaces) => block.split('\n').map(line => spaces >= 0 ? `${' '.repeat(spaces)}${line}` : line.slice(-spaces)).join('\n');
const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sharedResponseTemplate = path.join(skillRoot, 'assets', 'common', 'responses.yaml');
const standardResponses = ['BadRequestResponse', 'UnauthorizedResponse', 'ForbiddenResponse', 'NotFoundResponse', 'ConflictResponse', 'TooManyRequestsResponse', 'BadGatewayResponse', 'InternalServerErrorResponse'];
const errorResponseByStatus = { '400': 'BadRequestResponse', '401': 'UnauthorizedResponse', '403': 'ForbiddenResponse', '404': 'NotFoundResponse', '409': 'ConflictResponse', '429': 'TooManyRequestsResponse', '502': 'BadGatewayResponse', '500': 'InternalServerErrorResponse' };

function readYaml(file) {
  const doc = YAML.parseDocument(readFileSync(file, 'utf8'), { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`${file}: ${doc.errors.map(error => error.message).join('; ')}`);
  return doc.toJS();
}

function infer(value) {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array', items: value.length ? infer(value[0]) : {} };
  if (asObject(value)) return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, infer(item)])) };
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  return { type: typeof value };
}

function putSchema(doc, name, schema, replace) {
  doc.components ??= {};
  doc.components.schemas ??= {};
  const previous = doc.components.schemas[name];
  if (previous && !equal(previous, schema) && !replace) throw new Error(`Schema ${name} já existe com outra definição; use replace: true para alteração intencional`);
  doc.components.schemas[name] = schema;
  return { $ref: ref(name) };
}

function operation(doc, item, module, method, shared) {
  const id = item.operationId ?? method + (item.path.match(/[A-Za-z0-9]+/g) ?? []).map(camel).join('');
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) throw new Error(`operationId inválido: ${id}`);
  const result = { tags: item.tags ?? [module], summary: item.summary, operationId: id };
  if (item.description) result.description = item.description;
  if (item.security !== undefined) result.security = item.security;
  const routeParams = [...item.path.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);
  const params = (item.parameters ?? []).map(input => {
    if (!input?.name) throw new Error('Parâmetro sem name');
    const location = input.in ?? (routeParams.includes(input.name) ? 'path' : undefined);
    if (!['path', 'query', 'header', 'cookie'].includes(location)) throw new Error(`Local inválido para parâmetro ${input.name}`);
    const output = { name: input.name, in: location, schema: input.schema ?? (input.type ? { type: input.type } : Object.hasOwn(input, 'example') ? infer(input.example) : { type: 'string' }) };
    if (location === 'path' || input.required === true) output.required = true;
    if (input.description) output.description = input.description;
    if (Object.hasOwn(input, 'example')) output.example = input.example;
    return output;
  });
  for (const name of routeParams) if (!params.some(param => param.in === 'path' && param.name === name)) params.push({ name, in: 'path', required: true, schema: { type: 'string' } });
  const keys = params.map(param => `${param.in}:${param.name}`);
  if (new Set(keys).size !== keys.length) throw new Error(`Parâmetro duplicado em ${id}`);
  if (params.length) result.parameters = params;
  if (item.requestBody !== undefined) {
    if (method === 'get' || method === 'head') throw new Error(`${method.toUpperCase()} não aceita requestBody neste gerador`);
    const input = item.requestBody;
    const schema = input.schema ?? (Object.hasOwn(input, 'example') ? infer(input.example) : null);
    if (!schema) throw new Error(`requestBody de ${id} requer schema ou example`);
    const name = `${camel(id)}Request`;
    const media = { schema: putSchema(doc, name, schema, item.replace === true) };
    if (Object.hasOwn(input, 'example')) media.example = input.example;
    result.requestBody = { content: { [input.mediaType ?? 'application/json']: media } };
    if (input.required === true) result.requestBody.required = true;
    if (input.description) result.requestBody.description = input.description;
  }
  const responses = item.responses ?? { [STATUS[method]]: { description: STATUS[method] === '201' ? 'Created' : STATUS[method] === '204' ? 'No content' : 'Success' } };
  if (!asObject(responses) || !Object.keys(responses).length) throw new Error(`Respostas ausentes em ${id}`);
  result.responses = {};
  for (const [status, input] of Object.entries(responses)) {
    if (!/^(?:[1-5][0-9]{2}|default)$/.test(status) || !asObject(input)) throw new Error(`Resposta inválida ${status} em ${id}`);
    if (shared.enforce && errorResponseByStatus[status] && input.sharedResponse !== errorResponseByStatus[status]) throw new Error(`Resposta ${status} deve usar sharedResponse: ${errorResponseByStatus[status]}`);
    if (input.sharedResponse) {
      const name = input.sharedResponse;
      if (!/^[45][0-9]{2}$/.test(status)) throw new Error(`Resposta compartilhada ${name} requer status de erro`);
      if (typeof name !== 'string' || !Object.hasOwn(shared.document.components?.responses ?? {}, name)) throw new Error(`Resposta compartilhada ausente: ${name}`);
      if (Object.keys(input).length !== 1) throw new Error(`Resposta ${status}: sharedResponse não pode ter outros campos`);
      result.responses[status] = { $ref: `${shared.relativeRef}#/components/responses/${name}` };
      continue;
    }
    const output = { description: input.description ?? 'Response' };
    if (input.headers) output.headers = input.headers;
    if (input.schema !== undefined || Object.hasOwn(input, 'example')) {
      if (status === '204' || method === 'head') throw new Error(`Resposta ${status} de ${method.toUpperCase()} não pode ter corpo`);
      const name = `${camel(id)}${status === 'default' ? 'Default' : status}Response`;
      const media = { schema: putSchema(doc, name, input.schema ?? infer(input.example), item.replace === true) };
      if (Object.hasOwn(input, 'example')) media.example = input.example;
      output.content = { [input.mediaType ?? 'application/json']: media };
    }
    result.responses[status] = output;
  }
  return result;
}

function generatorExecution(module, basePackage, springBoot4, inputSpecPath) {
  const packageRoot = `${basePackage}.generated.${module.replaceAll('-', '_')}`;
  const options = springBoot4 ? '<useSpringBoot4>true</useSpringBoot4>\n                            <useJackson3>true</useJackson3>' : '<useSpringBoot3>true</useSpringBoot3>';
  return `                <execution>\n                    <id>generate-${module}-api</id>\n                    <phase>generate-sources</phase>\n                    <goals><goal>generate</goal></goals>\n                    <configuration>\n                        <inputSpec>\${project.basedir}/src/main/resources/openapi/${inputSpecPath}</inputSpec>\n                        <generatorName>spring</generatorName>\n                        <library>spring-boot</library>\n                        <output>\${project.build.directory}/generated-sources/openapi/${module}</output>\n                        <apiPackage>${packageRoot}.api</apiPackage>\n                        <modelPackage>${packageRoot}.model</modelPackage>\n                        <generateSupportingFiles>false</generateSupportingFiles>\n                        <configOptions>\n                            <interfaceOnly>true</interfaceOnly>\n                            <skipDefaultInterface>true</skipDefaultInterface>\n                            <useJakartaEe>true</useJakartaEe>\n                            <useBeanValidation>false</useBeanValidation>\n                            <performBeanValidation>false</performBeanValidation>\n                            <openApiNullable>false</openApiNullable>\n                            ${options}\n                        </configOptions>\n                    </configuration>\n                </execution>`;
}

function updatePom(source, module, basePackage, inputSpecPath) {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(basePackage)) throw new Error('basePackage Java obrigatório e inválido');
  const bootVersion = source.match(/<artifactId>spring-boot-starter-parent<\/artifactId>\s*<version>([^<]+)<\/version>/)?.[1] ?? source.match(/<spring-boot.version>([^<]+)<\/spring-boot.version>/)?.[1];
  if (!bootVersion || !/^[34]\./.test(bootVersion)) throw new Error('Não foi possível identificar Spring Boot 3 ou 4 no pom.xml; configure a execution manualmente');
  const block = generatorExecution(module, basePackage, bootVersion.startsWith('4.'), inputSpecPath);
  const plugins = source.match(/<plugins>([\s\S]*?)<\/plugins>/);
  if (!plugins) throw new Error('pom.xml sem <build><plugins>; configure o OpenAPI Generator manualmente');
  const pluginRegex = /<plugin>([\s\S]*?)<\/plugin>/g;
  const matches = [...plugins[0].matchAll(pluginRegex)].filter(match => /<artifactId>openapi-generator-maven-plugin<\/artifactId>/.test(match[1]));
  if (matches.length > 1) throw new Error('Plugin OpenAPI Generator duplicado no pom.xml');
  let updatedPlugins;
  if (matches.length) {
    const plugin = matches[0][0];
    const executionId = `generate-${module}-api`;
    if (plugin.includes(`<id>${executionId}</id>`)) {
      if (!plugin.includes(`openapi/${inputSpecPath}`)) throw new Error(`Execution ID ${executionId} já aponta para outro contrato`);
      return source;
    }
    if (plugin.includes(`openapi/${inputSpecPath}`)) return source;
    const executionIndent = plugin.match(/^([ \t]*)<executions>/m)?.[1].length ?? 12;
    const newPlugin = plugin.includes('<executions>')
      ? plugin.replace(/\n[ \t]*<\/executions>/, `\n${shiftIndent(block, executionIndent + 4 - 16)}\n${' '.repeat(executionIndent)}</executions>`)
      : plugin.replace('</plugin>', `    <executions>\n${block}\n            </executions>\n        </plugin>`);
    updatedPlugins = plugins[0].replace(plugin, newPlugin);
  } else {
    const version = source.match(/<openapi-generator.version>([^<]+)<\/openapi-generator.version>/) ? '${openapi-generator.version}' : '7.26.0';
    const plugin = `        <plugin>\n            <groupId>org.openapitools</groupId>\n            <artifactId>openapi-generator-maven-plugin</artifactId>\n            <version>${version}</version>\n            <executions>\n${block}\n            </executions>\n        </plugin>\n`;
    const pluginIndent = (source.match(/^([ \t]*)<plugins>/m)?.[1].length ?? 8) + 4;
    updatedPlugins = plugins[0].replace(/\n[ \t]*<\/plugins>/, `\n${shiftIndent(plugin, pluginIndent - 8)}${' '.repeat(pluginIndent - 4)}</plugins>`);
  }
  let result = source.replace(plugins[0], updatedPlugins);
  if (!/<artifactId>(?:spring-boot-starter-validation|jakarta.validation-api)<\/artifactId>/.test(result)) {
    const start = result.indexOf('</dependencyManagement>') >= 0 ? result.indexOf('</dependencyManagement>') + '</dependencyManagement>'.length : 0;
    const dependencies = result.slice(start).match(/<dependencies>([\s\S]*?)<\/dependencies>/);
    if (!dependencies) throw new Error('pom.xml sem seção de dependencies da API');
    const dependencyBlock = `        <dependency>\n            <groupId>org.springframework.boot</groupId>\n            <artifactId>spring-boot-starter-validation</artifactId>\n        </dependency>\n`;
    result = result.replace(dependencies[0], dependencies[0].replace(/\n[ \t]*<\/dependencies>/, `\n${dependencyBlock}    </dependencies>`));
  }
  return result;
}

export function scaffoldModule(project, config) {
  const module = config.module;
  if (!/^[a-z][a-z0-9-]*$/.test(module ?? '')) throw new Error('module explícito é obrigatório (minúsculo, números e hífen)');
  if (!Array.isArray(config.operations) || !config.operations.length) throw new Error('operations precisa de ao menos uma operação');
  const root = path.join(project, 'src', 'main', 'resources', 'openapi');
  const moduleEntry = path.join(root, 'modules', `${module}.yaml`);
  const olderEntry = path.join(root, `${module}.yaml`);
  if (existsSync(moduleEntry) && existsSync(olderEntry)) throw new Error(`Dois contratos encontrados para o módulo ${module}`);
  const entry = existsSync(moduleEntry) ? moduleEntry : existsSync(olderEntry) ? olderEntry : moduleEntry;
  const isNew = !existsSync(entry);
  const mode = config.mode ?? (isNew ? 'new-module' : 'existing-module');
  if (!['new-module', 'existing-module'].includes(mode) || (isNew && mode !== 'new-module')) throw new Error(`Modo ${mode} não corresponde à existência de ${entry}`);
  if (isNew && (!config.info?.title || !config.info?.version)) throw new Error('Novo módulo requer info.title e info.version');
  const pomPath = path.join(project, 'pom.xml');
  if (isNew && !existsSync(pomPath)) throw new Error('Novo módulo requer pom.xml da API');
  const listEntries = directory => existsSync(directory) ? readdirSync(directory).filter(name => /\.ya?ml$/.test(name) && !name.endsWith('.bundle.yaml')).map(name => path.join(directory, name)) : [];
  const files = [...listEntries(root), ...listEntries(path.join(root, 'modules'))];
  const others = files.filter(file => file !== entry).map(file => ({ file, doc: readYaml(file) }));
  const doc = isNew ? { openapi: '3.1.0', info: config.info, paths: {}, components: { schemas: {} } } : readYaml(entry);
  const originalDocument = JSON.stringify(doc);
  if (!/^3\.1\.\d+$/.test(String(doc.openapi))) throw new Error(`Contrato ${entry} não usa OpenAPI 3.1.x`);
  if (!asObject(doc.paths)) throw new Error(`paths inválido em ${entry}`);
  const sharedPath = path.join(root, 'common', 'responses.yaml');
  const sharedExists = existsSync(sharedPath);
  const sharedSource = sharedExists ? readFileSync(sharedPath, 'utf8') : readFileSync(sharedResponseTemplate, 'utf8');
  const sharedDocument = YAML.parse(sharedSource, { uniqueKeys: true });
  if (!asObject(sharedDocument?.components?.schemas?.ProblemDetail) || !asObject(sharedDocument?.components?.schemas?.FieldViolation) || !asObject(sharedDocument?.components?.responses)) throw new Error(`Fragmento de respostas inválido: ${sharedPath}`);
  if (sharedDocument.components.schemas.ProblemDetail.properties?.errors?.items?.$ref !== '#/components/schemas/FieldViolation') throw new Error('ProblemDetail.errors deve referenciar FieldViolation no mesmo arquivo');
  for (const name of standardResponses) {
    if (sharedDocument.components.responses[name]?.content?.['application/problem+json']?.schema?.$ref !== '#/components/schemas/ProblemDetail') throw new Error(`Resposta padronizada ausente ou inválida: ${name}`);
  }
  const sharedRelative = path.relative(path.dirname(entry), sharedPath).replaceAll('\\', '/');
  const shared = { document: sharedDocument, relativeRef: sharedRelative.startsWith('.') ? sharedRelative : `./${sharedRelative}`, enforce: entry === moduleEntry };
  const usesShared = config.operations.some(item => Object.values(item.responses ?? {}).some(response => response?.sharedResponse));
  const createShared = !sharedExists && (isNew || usesShared);
  const commonNames = new Set(Object.keys(sharedDocument.components.responses));
  if (doc.components?.schemas?.ProblemDetail || [...commonNames].some(name => doc.components?.responses?.[name])) throw new Error(`Respostas de erro compartilhadas duplicadas em ${entry}`);
  const externalIds = new Set();
  const externalRoutes = new Set();
  for (const { doc: other } of others) for (const [route, item] of Object.entries(other.paths ?? {})) for (const [method, op] of Object.entries(item ?? {})) {
    if (!METHODS.has(method)) continue;
    const key = `${method} ${route}`;
    if (externalRoutes.has(key)) throw new Error(`Operação duplicada entre contratos: ${key}`);
    externalRoutes.add(key);
    if (op?.operationId) {
      if (externalIds.has(op.operationId)) throw new Error(`operationId duplicado entre contratos: ${op.operationId}`);
      externalIds.add(op.operationId);
    }
  }
  let changed = isNew;
  for (const item of config.operations) {
    const method = String(item?.method ?? '').toLowerCase();
    if (!METHODS.has(method) || typeof item.path !== 'string' || !item.path.startsWith('/') || item.path.includes('?') || !item.summary?.trim()) throw new Error('Cada operação requer method, path e summary válidos');
    if (externalRoutes.has(`${method} ${item.path}`)) throw new Error(`${method.toUpperCase()} ${item.path} já pertence a outro contrato`);
    const existing = doc.paths[item.path]?.[method];
    const built = operation(doc, item, module, method, shared);
    if (externalIds.has(built.operationId)) throw new Error(`operationId duplicado em outro contrato: ${built.operationId}`);
    for (const [route, routeItem] of Object.entries(doc.paths)) for (const [verb, op] of Object.entries(routeItem ?? {})) {
      if (METHODS.has(verb) && !(route === item.path && verb === method) && op?.operationId === built.operationId) throw new Error(`operationId duplicado: ${built.operationId}`);
    }
    if (existing && !equal(existing, built) && item.replace !== true) throw new Error(`${method.toUpperCase()} ${item.path} já existe; use replace: true para atualizar`);
    if (!existing || !equal(existing, built)) changed = true;
    doc.paths[item.path] ??= {};
    doc.paths[item.path][method] = built;
  }
  changed ||= JSON.stringify(doc) !== originalDocument;
  const localIds = new Set();
  for (const [route, item] of Object.entries(doc.paths)) for (const [method, op] of Object.entries(item ?? {})) {
    if (!METHODS.has(method)) continue;
    if (externalRoutes.has(`${method} ${route}`)) throw new Error(`Operação duplicada entre contratos: ${method} ${route}`);
    if (op?.operationId) {
      if (externalIds.has(op.operationId) || localIds.has(op.operationId)) throw new Error(`operationId duplicado: ${op.operationId}`);
      localIds.add(op.operationId);
    }
  }
  const pomBefore = isNew ? readFileSync(pomPath, 'utf8') : null;
  const inputSpecPath = path.relative(root, entry).replaceAll('\\', '/');
  const pomAfter = isNew ? updatePom(pomBefore, module, config.basePackage, inputSpecPath) : null;
  const before = existsSync(entry) ? readFileSync(entry, 'utf8') : null;
  try {
    if (changed) {
      mkdirSync(path.dirname(entry), { recursive: true });
      writeFileSync(entry, YAML.stringify(doc, { indent: 4 }), 'utf8');
    }
    if (createShared) {
      mkdirSync(path.dirname(sharedPath), { recursive: true });
      writeFileSync(sharedPath, sharedSource, 'utf8');
    }
    if (isNew && pomAfter !== pomBefore) writeFileSync(pomPath, pomAfter, 'utf8');
    for (const file of [...files.filter(file => file !== entry), entry]) validate(file);
    return { entry, sharedResponses: sharedPath, module, created: isNew, changed, mavenUpdated: isNew && pomAfter !== pomBefore, validated: true };
  } catch (error) {
    if (before === null) { if (existsSync(entry)) unlinkSync(entry); }
    else writeFileSync(entry, before);
    if (createShared && existsSync(sharedPath)) unlinkSync(sharedPath);
    if (isNew) writeFileSync(pomPath, pomBefore);
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const project = args[args.indexOf('--project') + 1];
    const input = args[args.indexOf('--config') + 1];
    if (!args.includes('--project') || !args.includes('--config') || !project || !input) throw new Error('Uso: node module-scaffold.mjs --project <project> --config <input.json>');
    console.log(JSON.stringify(scaffoldModule(path.resolve(project), JSON.parse(readFileSync(path.resolve(input), 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
