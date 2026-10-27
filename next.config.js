/** @type {import('next').NextConfig} */
module.exports = {
  serverExternalPackages: ['pg', 'bcryptjs', 'web-push'],
  poweredByHeader: false,
  // Imágenes estáticas: el navegador las guarda una semana y las refresca en segundo plano
  async headers() {
    const sec = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    ];
    return [{ source: '/:path*', headers: sec }, { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] }, { source: '/:file*.(webp|jpg|png|ico)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] }];
  },
};
