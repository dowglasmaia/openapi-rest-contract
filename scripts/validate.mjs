#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(skillRoot, 'node_modules', '@redocly', 'cli', 'bin', 'cli.js');

export function validate(entry, bundle) {
  if (!existsSync(cli)) throw new Error(`Redocly CLI ausente. Execute npm ci em ${skillRoot}`);
  if (!existsSync(entry)) throw new Error(`Contrato ausente: ${entry}`);
  const document = YAML.parseDocument(readFileSync(entry, 'utf8'), { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors.map(error => error.message).join('\n'));
  const version = document.get('openapi');
  if (typeof version !== 'string' || !/^3\.1\.\d+$/.test(version)) {
    throw new Error(`Esperado OpenAPI 3.1.x em ${entry}`);
  }
  run(['lint', '--extends=spec', entry]);
  if (bundle) run(['bundle', entry, '--output', bundle]);
  return { entry, bundle: bundle ?? null, validated: true };
}

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Redocly ${args[0]} falhou (exit ${result.status})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const entry = args[0] ? path.resolve(args[0]) : null;
    const bundleIndex = args.indexOf('--bundle');
    if (!entry || (bundleIndex >= 0 && !args[bundleIndex + 1])) {
      throw new Error('Uso: node validate.mjs <openapi.yaml> [--bundle <output.yaml>]');
    }
    console.log(JSON.stringify(validate(entry, bundleIndex >= 0 ? path.resolve(args[bundleIndex + 1]) : null), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
