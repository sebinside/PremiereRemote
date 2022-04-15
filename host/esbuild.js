require('esbuild').build({
    entryPoints: ['build/index.jsx'],
    bundle: true,
    charset: "utf8",
    target: 'es5',
    format: 'iife',
    outfile: 'build/out/index.jsx',
  }).catch(() => process.exit(1))