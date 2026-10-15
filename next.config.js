/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ['pg', 'bcryptjs', 'web-push'],
  poweredByHeader: false,
  // Imágenes estáticas: el navegador las guarda una semana y las refresca en segundo plano
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] }, { source: '/:file*.(webp|jpg|png|ico)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] }];
  },
};
