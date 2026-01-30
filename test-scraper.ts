import { scrapeSearch } from './src/backend/lib/web-scraper';

async function test() {
  console.log('Testing TikTok...');
  try {
    const tiktok = await scrapeSearch('viral', 'tiktok', 5);
    console.log('TikTok Results:', tiktok);
  } catch (e) {
    console.error('TikTok error:', e);
  }

  console.log('Testing Instagram...');
  try {
      const insta = await scrapeSearch('reels', 'instagram', 5);
      console.log('Instagram Results:', insta);
  } catch (e) {
    console.error('Instagram error:', e);
  }
}

test();
