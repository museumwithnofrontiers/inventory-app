import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
    {
        ignores: [
            'node_modules/',
            'public/',
            'storage/',
            'vendor/',
            'dist/',
            '.git/',
            'build/',
            'docs/',
            'scripts/',
            'bootstrap/',
            '*.config.js',
            '*.config.cjs',
            'docs/vendor/',
            'scripts/'
        ],
    },
    {
        files: ['resources/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'prettier/prettier': 'error',
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
    prettier,
];
