module.exports = {
  apps: [
    {
      name: 'hisana-recruitment',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
    },
  ],
};
