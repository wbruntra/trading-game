module.exports = {
  apps: [
    {
      name: 'trading-game-backend',
      cwd: './backend',
      script: 'src/server.ts',
      interpreter: 'bun',
      env: {
        NODE_ENV: 'production',
        PORT: 4221,
      },
    },
  ],
}
