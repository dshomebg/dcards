import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

/**
 * Правила за кода (COD-1). **Твърдо правило е това, при което поправката е винаги
 * правилна** — иначе се ражда `eslint-disable`. Затова сложността е ГРЕШКА, а
 * дължината — ПРЕДУПРЕЖДЕНИЕ; таванът е НУЛА.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      // Генериран код — не се пише от нас, не се съди по нашите мерки.
      'drizzle/**',
      'next-env.d.ts',
      'REFERENCE/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.mjs', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // ---------------------------------------------------------- коректност
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ---------------------------------------------------------- сложност
      complexity: ['error', 12],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],

      // ------------------------------------------------------------ размер
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'warn',
        { max: 60, skipBlankLines: true, skipComments: true },
      ],

      // ------------------------------------------------------------ ред
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // ------------------------------------------------------- дублиране
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }],

      // `type Cents = number` е документация за мерната единица.
      'sonarjs/redundant-type-aliases': 'off',
    },
  },

  {
    // Декларации на таблици — всеки ред е колона.
    files: ['**/*.schema.ts'],
    rules: { 'max-lines': 'off' },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-identical-functions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
    },
  },

  {
    // Развойните скриптове викат инструменти по име (`git`, `docker`) и печатат.
    files: ['scripts/**/*.ts'],
    rules: {
      'sonarjs/no-os-command-from-path': 'off',
      'no-console': 'off',
    },
  },

  {
    files: ['*.config.mjs', '*.config.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'sonarjs/deprecation': 'off',
      'no-console': 'off',
    },
  },

  {
    // React компоненти: осемдесет реда декларативна разметка са нормални.
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': [
        'warn',
        { max: 120, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  {
    // ГРАНИЦИТЕ МЕЖДУ МОДУЛИТЕ (`ARC-2`): всеки изнася през `index.ts` точно каквото
    // другите могат да ползват, а дълбокият импорт заобикаля този договор.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/*', '!@/modules/*/index'],
              message:
                'Импортирай през barrel-а на модула (`@/modules/<модул>`). Липсва ли нужното там, добави го изрично — това е промяна на договора, не заобикаляне.',
            },
          ],
        },
      ],
    },
  },

  {
    // Вътре в модула дълбокият импорт е нормален; забраната е само за ЧУЖД модул,
    // а линтерът не знае кой е „свой" — затова вътре се ползват относителни пътища.
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/*', '!@/modules/*/index', '../*/*.schema'],
              message:
                'Чужд модул — само през barrel-а (`@/modules/<модул>`). Изключение: чужда СХЕМА при външен ключ (`../<модул>/<име>.schema`).',
            },
          ],
        },
      ],
    },
  },
);
