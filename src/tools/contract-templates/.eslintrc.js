module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        // Possible Errors
        'no-console': 'off', // Allow console for CLI tool
        'no-debugger': 'error',
        'no-unused-vars': ['error', { 
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_' 
        }],

        // Best Practices
        'curly': ['error', 'all'],
        'eqeqeq': ['error', 'always'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-return-await': 'error',
        'prefer-promise-reject-errors': 'error',

        // Variables
        'no-use-before-define': ['error', { 
            functions: false, 
            classes: true, 
            variables: true 
        }],

        // Stylistic Issues
        'array-bracket-spacing': ['error', 'never'],
        'block-spacing': ['error', 'always'],
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'comma-dangle': ['error', 'never'],
        'comma-spacing': ['error', { before: false, after: true }],
        'comma-style': ['error', 'last'],
        'computed-property-spacing': ['error', 'never'],
        'func-call-spacing': ['error', 'never'],
        'indent': ['error', 4, { 
            SwitchCase: 1,
            MemberExpression: 1,
            FunctionDeclaration: { parameters: 'first' },
            CallExpression: { arguments: 'first' }
        }],
        'key-spacing': ['error', { beforeColon: false, afterColon: true }],
        'keyword-spacing': ['error', { before: true, after: true }],
        'linebreak-style': ['error', 'unix'],
        'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
        'no-trailing-spaces': 'error',
        'object-curly-spacing': ['error', 'always'],
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'semi-spacing': ['error', { before: false, after: true }],
        'space-before-blocks': ['error', 'always'],
        'space-before-function-paren': ['error', 'never'],
        'space-in-parens': ['error', 'never'],
        'space-infix-ops': 'error',
        'space-unary-ops': ['error', { words: true, nonwords: false }],

        // ES6
        'arrow-spacing': ['error', { before: true, after: true }],
        'constructor-super': 'error',
        'no-const-assign': 'error',
        'no-dupe-class-members': 'error',
        'no-duplicate-imports': 'error',
        'no-new-symbol': 'error',
        'no-this-before-super': 'error',
        'no-var': 'error',
        'object-shorthand': ['error', 'always'],
        'prefer-arrow-callback': 'error',
        'prefer-const': 'error',
        'prefer-destructuring': ['error', { object: true, array: false }],
        'prefer-spread': 'error',
        'prefer-template': 'error',
        'template-curly-spacing': ['error', 'never']
    },
    overrides: [
        {
            files: ['**/__tests__/**/*.js', '**/*.test.js'],
            env: {
                jest: true
            },
            rules: {
                'no-unused-expressions': 'off'
            }
        }
    ]
};