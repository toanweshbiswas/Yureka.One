import fs from 'fs';
import path from 'path';
import { buildSitemapXml } from '../lib/seo/sitemap';

async function generateSitemap() {
  const xml = await buildSitemapXml();
  const outputPath = path.resolve(process.cwd(), 'public/sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  const count = (xml.match(/<loc>/g) || []).length;
  console.log(`Sitemap generated successfully at public/sitemap.xml (${count} URLs)`);
}

void generateSitemap();
