module.exports = {
  apps: [
    {
      name: 'trading-game-backend',
      cwd: './backend',
      script: 'src/server.ts',
      interpreter: 'bun',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4221,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 4221,
      },
    },
  ],
}
