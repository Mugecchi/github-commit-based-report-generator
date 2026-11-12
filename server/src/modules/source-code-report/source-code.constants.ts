export const SOURCE_CODE_EXTENSIONS: Record<string, string> = {
  // TypeScript & JavaScript
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.mjs': 'JavaScript (ESM)',
  '.cjs': 'JavaScript (CommonJS)',

  // Web & Styles
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.astro': 'Astro',

  // Backend & Systems
  '.py': 'Python',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin Script',
  '.swift': 'Swift',
  '.c': 'C',
  '.h': 'C Header',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++ Header',
  '.cs': 'C#',
  '.php': 'PHP',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.r': 'R',
  '.scala': 'Scala',

  // Query & Data & Scripting
  '.sql': 'SQL',
  '.prisma': 'Prisma Schema',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.proto': 'Protocol Buffer',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.sh': 'Shell Script',
  '.bash': 'Bash Script',
  '.zsh': 'Zsh Script',
  '.env.example': 'Config / Env Template',
};

export const IGNORED_DIRS = new Set([
  '.git',
  '.github',
  '.vscode',
  '.idea',
  '.husky',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  '.vite',
  '.turbo',
  'bin',
  'obj',
  'vendor',
  'bower_components',
  '.gemini',
  '.agents',
]);

export const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'composer.lock',
  'cargo.lock',
  'gemfile.lock',
  'poetry.lock',
]);

export const IGNORED_SUFFIXES = [
  '.min.js',
  '.min.css',
  '.map',
  '.d.ts.map',
  '.bundle.js',
  '.chunk.js',
];

export const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB limit per file to avoid runaway document sizes

/**
 * Returns language name if file is a recognized source file, or null if ignored.
 */
export function getSourceLanguage(filePath: string): string | null {
  const norm = filePath.replace(/\\/g, '/');
  const filename = norm.split('/').pop() || '';
  const lowerFilename = filename.toLowerCase();

  if (IGNORED_FILENAMES.has(lowerFilename)) {
    return null;
  }

  for (const suffix of IGNORED_SUFFIXES) {
    if (lowerFilename.endsWith(suffix)) {
      return null;
    }
  }

  // Check known extensions
  for (const [ext, lang] of Object.entries(SOURCE_CODE_EXTENSIONS)) {
    if (lowerFilename.endsWith(ext.toLowerCase())) {
      return lang;
    }
  }

  return null;
}
