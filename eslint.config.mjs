import next from 'eslint-config-next';
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'docs/html-css/static/**', 'docs/tsx/**'] },
  ...next
];
export default config;
