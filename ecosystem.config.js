module.exports = {
  apps: [
    {
      name: 'hch-restaurant',
      script: 'server.js',
      cwd: './.next/standalone',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
