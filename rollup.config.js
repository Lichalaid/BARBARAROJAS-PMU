import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/config/index.ts', // Asegúrate de que este archivo existe
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json', // Asegúrate de que este archivo existe
    }),
  ],
};
