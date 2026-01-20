/**
 * /gen-docs - Generate documentation from code
 */

import { readFile, readdir, writeFile, stat } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import type { CommandConfig, CommandResult, ExecutionContext } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'gen-docs',
  description: 'Generate documentation from source code',
  args: [
    {
      name: 'path',
      description: 'Path to document (file or directory)',
      type: 'string',
      required: false,
      default: 'src',
    },
    {
      name: 'output',
      description: 'Output file path',
      type: 'string',
      required: false,
      default: 'docs/API.md',
    },
    {
      name: 'format',
      description: 'Output format (markdown, json)',
      type: 'string',
      required: false,
      default: 'markdown',
    },
  ],
  selfInvokable: false,
  triggers: [],
};

interface FunctionDoc {
  name: string;
  description: string;
  params: Array<{ name: string; type: string; description: string }>;
  returns: { type: string; description: string } | null;
  async: boolean;
  exported: boolean;
}

interface InterfaceDoc {
  name: string;
  description: string;
  properties: Array<{ name: string; type: string; optional: boolean; description: string }>;
  exported: boolean;
}

interface FileDoc {
  path: string;
  description: string;
  functions: FunctionDoc[];
  interfaces: InterfaceDoc[];
  exports: string[];
}

function parseJSDocComment(comment: string): { description: string; tags: Map<string, string[]> } {
  const lines = comment
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim());

  const tags = new Map<string, string[]>();
  let description = '';
  let currentTag = '';
  let currentValue = '';

  for (const line of lines) {
    if (line.startsWith('@')) {
      // Save previous tag
      if (currentTag) {
        const existing = tags.get(currentTag) ?? [];
        existing.push(currentValue.trim());
        tags.set(currentTag, existing);
      }

      const match = line.match(/^@(\w+)\s*(.*)/);
      if (match) {
        currentTag = match[1];
        currentValue = match[2];
      }
    } else if (currentTag) {
      currentValue += ' ' + line;
    } else {
      description += (description ? ' ' : '') + line;
    }
  }

  // Save last tag
  if (currentTag) {
    const existing = tags.get(currentTag) ?? [];
    existing.push(currentValue.trim());
    tags.set(currentTag, existing);
  }

  return { description: description.trim(), tags };
}

function extractFunctions(content: string): FunctionDoc[] {
  const functions: FunctionDoc[] = [];

  // Match function declarations with optional JSDoc
  const functionPattern = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(export\s+)?(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*(?::\s*([^{]+))?\s*\{/g;

  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    const [, jsdoc, exported, async, name, params, returnType] = match;

    const doc = jsdoc ? parseJSDocComment('/**' + jsdoc + '*/') : { description: '', tags: new Map() };

    const paramList: FunctionDoc['params'] = [];
    if (params.trim()) {
      const paramMatches = params.matchAll(/(\w+)\s*(?:\?\s*)?(?::\s*([^,=]+))?/g);
      const paramTags = doc.tags.get('param') ?? [];

      for (const pm of paramMatches) {
        const paramName = pm[1];
        const paramType = pm[2]?.trim() ?? 'unknown';

        // Find description from @param tag
        const paramTag = paramTags.find((t: string) => t.includes(paramName));
        const paramDesc = paramTag?.replace(new RegExp(`^\\{[^}]*\\}\\s*${paramName}\\s*-?\\s*`), '') ?? '';

        paramList.push({
          name: paramName,
          type: paramType,
          description: paramDesc,
        });
      }
    }

    functions.push({
      name,
      description: doc.description,
      params: paramList,
      returns: returnType ? { type: returnType.trim(), description: doc.tags.get('returns')?.[0] ?? '' } : null,
      async: !!async,
      exported: !!exported,
    });
  }

  // Also match arrow functions
  const arrowPattern = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(async\s*)?\(([\s\S]*?)\)\s*(?::\s*([^=]+))?\s*=>/g;

  while ((match = arrowPattern.exec(content)) !== null) {
    const [, jsdoc, exported, name, async, params, returnType] = match;

    const doc = jsdoc ? parseJSDocComment('/**' + jsdoc + '*/') : { description: '', tags: new Map() };

    const paramList: FunctionDoc['params'] = [];
    if (params.trim()) {
      const paramMatches = params.matchAll(/(\w+)\s*(?:\?\s*)?(?::\s*([^,=]+))?/g);
      for (const pm of paramMatches) {
        paramList.push({
          name: pm[1],
          type: pm[2]?.trim() ?? 'unknown',
          description: '',
        });
      }
    }

    functions.push({
      name,
      description: doc.description,
      params: paramList,
      returns: returnType ? { type: returnType.trim(), description: '' } : null,
      async: !!async,
      exported: !!exported,
    });
  }

  return functions;
}

function extractInterfaces(content: string): InterfaceDoc[] {
  const interfaces: InterfaceDoc[] = [];

  const interfacePattern = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(export\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{([\s\S]*?)\}/g;

  let match;
  while ((match = interfacePattern.exec(content)) !== null) {
    const [, jsdoc, exported, name, body] = match;

    const doc = jsdoc ? parseJSDocComment('/**' + jsdoc + '*/') : { description: '', tags: new Map() };

    const properties: InterfaceDoc['properties'] = [];
    const propPattern = /(\w+)(\?)?:\s*([^;]+);/g;

    let propMatch;
    while ((propMatch = propPattern.exec(body)) !== null) {
      properties.push({
        name: propMatch[1],
        type: propMatch[3].trim(),
        optional: !!propMatch[2],
        description: '',
      });
    }

    interfaces.push({
      name,
      description: doc.description,
      properties,
      exported: !!exported,
    });
  }

  return interfaces;
}

async function processFile(filePath: string): Promise<FileDoc | null> {
  const ext = extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');

  // Extract file-level JSDoc
  const fileDocMatch = content.match(/^\/\*\*([\s\S]*?)\*\//);
  const fileDoc = fileDocMatch
    ? parseJSDocComment(fileDocMatch[0])
    : { description: '', tags: new Map() };

  const functions = extractFunctions(content);
  const interfaces = extractInterfaces(content);

  // Extract named exports
  const exports: string[] = [];
  const exportMatches = content.matchAll(/export\s+\{([^}]+)\}/g);
  for (const m of exportMatches) {
    const names = m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
    exports.push(...names);
  }

  if (functions.length === 0 && interfaces.length === 0) {
    return null;
  }

  return {
    path: filePath,
    description: fileDoc.description,
    functions,
    interfaces,
    exports,
  };
}

async function processDirectory(dirPath: string): Promise<FileDoc[]> {
  const docs: FileDoc[] = [];

  const entries = await readdir(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry)) {
        const subDocs = await processDirectory(fullPath);
        docs.push(...subDocs);
      }
    } else {
      const doc = await processFile(fullPath);
      if (doc) {
        docs.push(doc);
      }
    }
  }

  return docs;
}

function generateMarkdown(docs: FileDoc[]): string {
  const lines: string[] = [
    '# API Documentation',
    '',
    `Generated on ${new Date().toISOString()}`,
    '',
    '## Table of Contents',
    '',
  ];

  // Generate TOC
  for (const doc of docs) {
    const fileName = basename(doc.path);
    lines.push(`- [${fileName}](#${fileName.replace(/\./g, '')})`);
  }

  lines.push('', '---', '');

  // Generate documentation for each file
  for (const doc of docs) {
    const fileName = basename(doc.path);
    lines.push(`## ${fileName}`, '');

    if (doc.description) {
      lines.push(doc.description, '');
    }

    lines.push(`**Path:** \`${doc.path}\``, '');

    if (doc.interfaces.length > 0) {
      lines.push('### Interfaces', '');

      for (const iface of doc.interfaces) {
        const exportBadge = iface.exported ? ' (exported)' : '';
        lines.push(`#### ${iface.name}${exportBadge}`, '');

        if (iface.description) {
          lines.push(iface.description, '');
        }

        if (iface.properties.length > 0) {
          lines.push('| Property | Type | Required | Description |');
          lines.push('|----------|------|----------|-------------|');

          for (const prop of iface.properties) {
            const required = prop.optional ? 'No' : 'Yes';
            lines.push(`| \`${prop.name}\` | \`${prop.type}\` | ${required} | ${prop.description} |`);
          }
          lines.push('');
        }
      }
    }

    if (doc.functions.length > 0) {
      lines.push('### Functions', '');

      for (const func of doc.functions) {
        const asyncBadge = func.async ? 'async ' : '';
        const exportBadge = func.exported ? ' (exported)' : '';
        lines.push(`#### ${asyncBadge}${func.name}()${exportBadge}`, '');

        if (func.description) {
          lines.push(func.description, '');
        }

        if (func.params.length > 0) {
          lines.push('**Parameters:**', '');
          for (const param of func.params) {
            lines.push(`- \`${param.name}\`: \`${param.type}\` - ${param.description}`);
          }
          lines.push('');
        }

        if (func.returns) {
          lines.push(`**Returns:** \`${func.returns.type}\``, '');
          if (func.returns.description) {
            lines.push(func.returns.description, '');
          }
        }
      }
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

export async function execute(
  args: Record<string, unknown>,
  context?: ExecutionContext
): Promise<CommandResult> {
  const cwd = context?.cwd ?? process.cwd();
  const targetPath = join(cwd, (args.path as string) ?? 'src');
  const outputPath = join(cwd, (args.output as string) ?? 'docs/API.md');
  const format = (args.format as string) ?? 'markdown';

  try {
    const stats = await stat(targetPath);
    let docs: FileDoc[];

    if (stats.isDirectory()) {
      docs = await processDirectory(targetPath);
    } else {
      const doc = await processFile(targetPath);
      docs = doc ? [doc] : [];
    }

    if (docs.length === 0) {
      return {
        success: false,
        output: '',
        error: 'No documentable code found',
      };
    }

    let output: string;

    if (format === 'json') {
      output = JSON.stringify(docs, null, 2);
    } else {
      output = generateMarkdown(docs);
    }

    // Ensure output directory exists
    const { mkdir } = await import('fs/promises');
    await mkdir(dirname(outputPath), { recursive: true });

    await writeFile(outputPath, output);

    const summary = [
      `✅ Documentation generated successfully`,
      '',
      `Files processed: ${docs.length}`,
      `Total functions: ${docs.reduce((sum, d) => sum + d.functions.length, 0)}`,
      `Total interfaces: ${docs.reduce((sum, d) => sum + d.interfaces.length, 0)}`,
      '',
      `Output: ${outputPath}`,
    ].join('\n');

    return {
      success: true,
      output: summary,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
