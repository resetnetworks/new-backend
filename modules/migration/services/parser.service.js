import { parseScrapedData } from "../adapters/bandcamp/parser/bandcampParser.js";

export const parseData = (rawData) => {
  return parseScrapedData(rawData);
};

export const bandcampParserService = {
  parseData,
};

export default bandcampParserService;
