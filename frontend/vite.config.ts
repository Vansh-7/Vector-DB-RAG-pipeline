import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { publicMetadata, publicSiteUrl } from './src/lib/siteMetadata.ts'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = publicSiteUrl(process.env.VITE_PUBLIC_SITE_URL ?? environment.VITE_PUBLIC_SITE_URL);
  const escapeAttribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const metadata = publicMetadata(siteUrl).map(({ tag, attrs }) =>
    `<${tag} ${Object.entries(attrs).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(' ')} />`).join('\n    ');

  return {
    plugins: [react(), {
      name: 'neuebit-public-metadata',
      transformIndexHtml: {
        order: 'pre',
        handler: (html: string) => html
          .replace('<!-- public-share-metadata -->', metadata)
          .replace('<!-- entry-robots -->', `<meta name="robots" content="${siteUrl ? 'index, follow' : 'noindex, nofollow'}" />`),
      },
    }],
  };
})
