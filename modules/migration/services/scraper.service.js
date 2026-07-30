import { scrapeArtistData } from "../adapters/bandcamp/scraper/bandcampScraper.js";

export const scrapeArtist = async (url) => {
  return await scrapeArtistData(url);
};

export const bandcampScraperService = {
  scrapeArtist,
};

export default bandcampScraperService;
