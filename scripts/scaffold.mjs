#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { validate } from './validate.mjs';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head']);
const defaultStatus = { get: '200', post: '201', put: '200', patch: '200', delete: '204', head: '200' };
const defaultDescription = { '200': 'Success', '201': 'Created', '204': 'No content' };

function parseYaml(file, fallback) {
  if (!existsSync(file)) return new YAML.Document(fallback);
  const document = YAML.parseDocument(readFileSync(file, 'utf8'), { uniqueKeys: true });
  if (document.errors.length) throw new Error(`${file}: ${document.errors.map(x => x.message).join('; ')}`);
  if (!document.contents || typeof document.toJS() !== 'object' || Array.isArray(document.toJS())) {
    throw new Error(`Esperado mapa YAML em ${file}`);
  }
  return document;
}

function inferSchema(value) {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const variants = [...new Map(value.map(item => {
      const schema = inferSchema(item);
      return [JSON.stringify(schema), schema];
    })).values()];
    return { type: 'array', items: variants.length === 0 ? {} : variants.length === 1 ? variants[0] : { anyOf: variants } };
  }
  if (typeof value === 'object') {
    return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inferSchema(item)])) };
  }
  if (typeof value === 'string') return { type: 'string' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  throw new Error(`Exemplo JSON inválido: ${typeof value}`);
}

function pointer(value) { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }
function safeName(value) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(value)) throw new Error(`Nome inválido: ${value}`);
  return value;
}
function operationId(method, route) {
  const words = route.match(/[A-Za-z0-9]+/g) ?? [];
  return method + words.map(word => word[0].toUpperCase() + word.slice(1)).join('');
}

function addSchema(root, registry, files, name, section, schema, replace) {
  const file = path.join(root, 'components', 'schemas', section, `${name}.yaml`);
  if (existsSync(file)) {
    const old = parseYaml(file, {}).toJS();
    if (JSON.stringify(old) !== JSON.stringify(schema)) {
      if (!replace) throw new Error(`Schema existente com conteúdo diferente: ${file}`);
      files.set(file, YAML.stringify(schema));
    }
  } else files.set(file, YAML.stringify(schema));
  const reference = `./components/schemas/${section}/${name}.yaml`;
  const current = registry.getIn(['components', 'schemas', name]);
  if (current && (current.toJSON?.() ?? current).$ref !== reference) throw new Error(`Componente já registrado: ${name}`);
  registry.setIn(['components', 'schemas', name], { $ref: reference });
  return `../components/schemas/${section}/${name}.yaml`;
}

function parameterObject(item, routeParams) {
  if (!item || typeof item.name !== 'string') throw new Error('Parâmetro sem name');
  const location = item.in ?? (routeParams.has(item.name) ? 'path' : null);
  if (!['path', 'query', 'header', 'cookie'].includes(location)) throw new Error(`Local do parâmetro ${item.name} ausente ou inválido`);
  const schema = item.schema ?? (item.type ? { type: item.type } : Object.hasOwn(item, 'example') ? inferSchema(item.example) : { type: 'string' });
  const result = { name: item.name, in: location, schema };
  if (location === 'path' || item.required === true) result.required = true;
  if (item.description) result.description = item.description;
  if (Object.hasOwn(item, 'example')) result.example = item.example;
  return result;
}

function buildOperation(item, method, root, entry, files) {
  const id = safeName(item.operationId ?? operationId(method, item.path));
  const result = { tags: item.tags ?? [item.profile], summary: item.summary, operationId: id };
  if (item.description) result.description = item.description;
  if (item.security !== undefined) result.security = item.security;
  const routeParams = new Set([...item.path.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]));
  const params = (item.parameters ?? []).map(param => parameterObject(param, routeParams));
  for (const name of routeParams) {
    if (!params.some(param => param.in === 'path' && param.name === name)) params.push({ name, in: 'path', required: true, schema: { type: 'string' } });
  }
  const unique = new Set();
  for (const param of params) {
    const key = `${param.in}:${param.name}`;
    if (unique.has(key)) throw new Error(`Parâmetro duplicado: ${key}`);
    unique.add(key);
  }
  if (params.length) result.parameters = params;
  if (item.requestBody !== undefined) {
    if (method === 'get' || method === 'head') throw new Error(`${method.toUpperCase()} não deve ter requestBody`);
    const body = item.requestBody;
    const schema = body.schema ?? (Object.hasOwn(body, 'example') ? inferSchema(body.example) : null);
    if (!schema) throw new Error(`requestBody de ${id} precisa de schema ou example`);
    const ref = addSchema(root, entry, files, `${id[0].toUpperCase()}${id.slice(1)}Request`, 'requests', schema, item.replace === true);
    const media = { schema: { $ref: ref } };
    if (Object.hasOwn(body, 'example')) media.example = body.example;
    result.requestBody = { content: { [body.mediaType ?? 'application/json']: media } };
    if (body.required === true) result.requestBody.required = true;
    if (body.description) result.requestBody.description = body.description;
  }
  const responses = item.responses ?? { [defaultStatus[method]]: { description: defaultDescription[defaultStatus[method]] } };
  if (!responses || Object.keys(responses).length === 0) throw new Error(`Operação ${id} sem respostas`);
  result.responses = {};
  for (const [status, response] of Object.entries(responses)) {
    if (!/^(?:[1-5][0-9][0-9]|default)$/.test(status)) throw new Error(`Status inválido: ${status}`);
    if (!response || typeof response !== 'object') throw new Error(`Resposta ${status} inválida`);
    const output = { description: response.description ?? defaultDescription[status] ?? 'Response' };
    if (response.headers) output.headers = response.headers;
    const hasBody = response.schema !== undefined || Object.hasOwn(response, 'example');
    if (hasBody && (method === 'head' || status === '204')) throw new Error(`Resposta ${status} de ${method.toUpperCase()} não pode ter corpo`);
    if (hasBody) {
      const schema = response.schema ?? inferSchema(response.example);
      const name = `${id[0].toUpperCase()}${id.slice(1)}${status === 'default' ? 'Default' : status}Response`;
      const ref = addSchema(root, entry, files, name, 'responses', schema, item.replace === true);
      const media = { schema: { $ref: ref } };
      if (Object.hasOwn(response, 'example')) media.example = response.example;
      output.content = { [response.mediaType ?? 'application/json']: media };
    }
    result.responses[status] = output;
  }
  return result;
}

function scaffold(project, config) {
  if (!existsSync(project)) throw new Error(`Projeto ausente: ${project}`);
  if (!Array.isArray(config.operations) || config.operations.length === 0) throw new Error('operations precisa de ao menos uma operação');
  const root = path.join(project, 'src', 'main', 'resources', 'openapi');
  const entryPath = path.join(root, 'openapi.yaml');
  const isNew = !existsSync(entryPath);
  if (isNew && (!config.info?.title || !config.info?.version)) throw new Error('Novo contrato precisa de info.title e info.version');
  const entry = parseYaml(entryPath, { openapi: '3.1.0', info: config.info, paths: {} });
  if (!/^3\.1\.\d+$/.test(String(entry.get('openapi')))) throw new Error('Contrato existente não usa OpenAPI 3.1.x');
  const files = new Map();
  const profiles = new Map();
  for (const item of config.operations) {
    if (!item || !/^[a-z][a-z0-9-]*$/.test(item.profile ?? '')) throw new Error('profile deve ser minúsculo, com letras, números ou hífen');
    const method = String(item.method ?? '').toLowerCase();
    if (!methods.has(method)) throw new Error(`Método inválido: ${item.method}`);
    if (typeof item.path !== 'string' || !item.path.startsWith('/') || item.path.includes('?')) throw new Error(`Path inválido: ${item.path}`);
    if (typeof item.summary !== 'string' || !item.summary.trim()) throw new Error(`summary ausente para ${item.path}`);
    const profileFile = path.join(root, 'paths', `${item.profile}.yaml`);
    const profileDoc = profiles.get(profileFile) ?? parseYaml(profileFile, {});
    profiles.set(profileFile, profileDoc);
    const ref = `./paths/${item.profile}.yaml#/${pointer(item.path)}`;
    const currentPathRef = entry.getIn(['paths', item.path]);
    if (currentPathRef && (currentPathRef.toJSON?.() ?? currentPathRef).$ref !== ref) throw new Error(`Path ${item.path} já usa outra definição`);
    const previous = profileDoc.getIn([item.path, method]);
    if (previous && item.replace !== true) throw new Error(`${method.toUpperCase()} ${item.path} já existe; use replace: true para atualizar`);
    const operation = buildOperation(item, method, root, entry, files);
    profileDoc.setIn([item.path, method], operation);
    entry.setIn(['paths', item.path], { $ref: ref });
    const tags = entry.toJS().tags ?? [];
    for (const tag of operation.tags) if (!tags.some(existing => existing.name === tag)) tags.push({ name: tag });
    entry.set('tags', tags);
  }
  for (const [file, doc] of profiles) files.set(file, String(doc));
  files.set(entryPath, String(entry));
  const bundle = path.join(root, 'openapi.bundle.yaml');
  const backups = new Map();
  for (const file of [...files.keys(), bundle]) backups.set(file, existsSync(file) ? readFileSync(file) : null);
  try {
    for (const [file, content] of files) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content, 'utf8');
    }
    validate(entryPath, bundle);
    return { entry: entryPath, bundle, operations: config.operations.length, validated: true };
  } catch (error) {
    for (const [file, content] of backups) {
      if (content === null) { if (existsSync(file)) unlinkSync(file); }
      else writeFileSync(file, content);
    }
    throw error;
  }
}

try {
  const args = process.argv.slice(2);
  const project = args[args.indexOf('--project') + 1];
  const input = args[args.indexOf('--config') + 1];
  if (!project || !input || !args.includes('--project') || !args.includes('--config')) {
    throw new Error('Uso: node scaffold.mjs --project <project-root> --config <input.json>');
  }
  console.log(JSON.stringify(scaffold(path.resolve(project), JSON.parse(readFileSync(path.resolve(input), 'utf8'))), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
