/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { serverComponentsExternalPackages: ['pg', 'bcryptjs'] },
  poweredByHeader: false,
  // Imágenes estáticas: el navegador las guarda una semana y las refresca en segundo plano
  async headers() {
    return [{ source: '/:file*.(webp|jpg|png|ico)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] }];
  },
};
