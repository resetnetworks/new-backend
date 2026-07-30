import axios from "axios";

export async function downloadUrlToBuffer(url) {
  if (process.env.MOCK_MIGRATION === "true") {
    console.log(`[Mock Downloader] Intercepted downloadUrlToBuffer for ${url}`);
    return {
      buffer: Buffer.from("dummy-image-binary-data"),
      contentType: "image/jpeg",
    };
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15_000,
  });

  return {
    buffer: Buffer.from(response.data),
    contentType: response.headers["content-type"] || "image/jpeg",
  };
}

export default { downloadUrlToBuffer };
