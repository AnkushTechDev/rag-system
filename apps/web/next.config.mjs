import { loadEnvFile } from 'node:process';
try {
  loadEnvFile(new URL('../../.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
/** Frontend and backend are separate processes in one monorepo, accessed through one browser origin. */
const config = {
  // An absolute environment path makes root configuration work from either npm workspace.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://127.0.0.1:4100'}/api/:path*`,
      },
    ];
  },
};
export default config;
