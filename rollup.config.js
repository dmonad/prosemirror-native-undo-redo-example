import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

export default {
  input: './index.js',
  output: {
    file: './dist/index.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      sourcemap: true,
      module: true,
      browser: true
    }),
    commonjs()
  ]
}
