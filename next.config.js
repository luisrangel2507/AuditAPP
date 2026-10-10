/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { serverComponentsExternalPackages: ['pg', 'bcryptjs'] },
  poweredByHeader: false,
};
