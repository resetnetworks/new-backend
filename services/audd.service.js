import axios from "axios";
import dotenv from "dotenv";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Song } from "../models/song.model.js";
import { s3 } from "../utils/s3.js";
import { buildCdnUrl } from "../utils/cdn/cdn.js";

/**
 * Fetch audio stream/buffer via CloudFront CDN or S3
 * and prepare direct binary file payload for AudD.
 */
async function getAudioPayload(song) {
  if (!song.audioKey) return { type: "none" };

  const fileName = song.audioKey.split("/").pop() || "audio.wav";
  const cdnUrl = buildCdnUrl(song.audioKey);

  // 1. Try downloading audio buffer directly from CloudFront (Fastest & most reliable)
  if (cdnUrl) {
    try {
      console.log(`[AudD Service] 📥 Fetching audio buffer from CDN: ${cdnUrl}`);
      const cdnResp = await axios.get(cdnUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
      });

      if (cdnResp.status === 200 && cdnResp.data) {
        const buffer = Buffer.from(cdnResp.data);
        const mimeType = cdnResp.headers["content-type"] || "audio/wav";
        console.log(`[AudD Service] ✅ Audio buffer downloaded (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        return {
          type: "file",
          buffer,
          fileName,
          mimeType,
        };
      }
    } catch (err) {
      console.warn(`[AudD Service] Could not fetch from CDN (${err.message}). Trying S3...`);
    }
  }

  // 2. Try fetching audio buffer directly from S3
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    if (bucket) {
      const s3Response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: song.audioKey,
        })
      );

      if (s3Response && s3Response.Body) {
        const byteArray = await s3Response.Body.transformToByteArray();
        const buffer = Buffer.from(byteArray);
        const mimeType = s3Response.ContentType || "audio/wav";

        return {
          type: "file",
          buffer,
          fileName,
          mimeType,
        };
      }
    }
  } catch (err) {
    console.warn(`[AudD Service] Could not fetch directly from S3 (${err.message}).`);
  }

  // 3. Fallback to S3 Presigned URL
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    if (bucket) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: song.audioKey,
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
      return { type: "url", url: signedUrl };
    }
  } catch (e) {
    console.warn("[AudD Service] S3 presign fallback error:", e.message);
  }

  return { type: "url", url: cdnUrl };
}

/**
 * Perform AudD copyright check for a song by songId
 * @param {string} songId - MongoDB ObjectId of the song
 * @param {string} [customAudioUrl] - Optional direct audio URL to check
 */
export const checkSongCopyright = async (songId, customAudioUrl = null) => {
  try {
    dotenv.config(); // Reload .env to ensure fresh token is read

    const song = await Song.findById(songId);
    if (!song) {
      throw new Error(`Song not found for copyright check: ${songId}`);
    }

    const apiToken = process.env.AUDD_API_TOKEN || "test";
    const audioPayload = customAudioUrl
      ? { type: "url", url: customAudioUrl }
      : await getAudioPayload(song);

    if (audioPayload.type === "none") {
      throw new Error(`No audio file or key found for song: ${songId}`);
    }

    console.log(
      `[AudD Service] 🔍 Sending multipart/form-data to https://api.audd.io/ for song "${song.title}" (${songId})...`
    );

    // Build FormData payload (multipart/form-data)
    const formData = new FormData();
    formData.append("api_token", apiToken);
    formData.append("return", "apple_music,spotify,deezer,lis_tn");

    if (audioPayload.type === "file") {
      const blob = new Blob([audioPayload.buffer], { type: audioPayload.mimeType });
      formData.append("file", blob, audioPayload.fileName);
      console.log(`[AudD Service] 📦 Attaching audio file stream (${(audioPayload.buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      formData.append("url", audioPayload.url);
      console.log(`[AudD Service] 📡 Attaching audio URL: ${audioPayload.url}`);
    }

    // Direct HTTP POST to AudD API with 20-second timeout
    const response = await axios.post("https://api.audd.io/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 20000,
    });

    const data = response.data;
    console.log(`[AudD Service] 📥 Raw response from AudD API:`, JSON.stringify(data));

    // Handle AudD Error responses
    if (data.status === "error") {
      const errMsg = data.error?.error_message || "AudD API error";
      console.warn(`[AudD Service] ⚠️ AudD returned error (${data.error?.error_code}): ${errMsg}`);

      song.copyrightCheck = {
        checked: true,
        status: "error",
        matchedTitle: "",
        matchedArtist: "",
        matchedIsrc: "",
        matchScore: 0,
        rawResponse: data,
        checkedAt: new Date(),
      };
      await song.save();
      return song.copyrightCheck;
    }

    // Handle Commercial Match Found
    if (data.status === "success" && data.result) {
      const match = data.result;
      console.warn(
        `[AudD Service] ⚠️ Commercial copyright match found: "${match.title}" by ${match.artist}`
      );

      song.copyrightCheck = {
        checked: true,
        status: "match_found",
        matchedTitle: match.title || "Unknown Title",
        matchedArtist: match.artist || "Unknown Artist",
        matchedIsrc: match.isrc || match.spotify?.external_ids?.isrc || "",
        matchScore: 100,
        rawResponse: data,
        checkedAt: new Date(),
      };
    } else {
      // Handle Clean Track (No Match Found)
      console.log(`[AudD Service] ✅ No commercial copyright match found for song "${song.title}"`);
      song.copyrightCheck = {
        checked: true,
        status: "clean",
        matchedTitle: "",
        matchedArtist: "",
        matchedIsrc: "",
        matchScore: 0,
        rawResponse: data,
        checkedAt: new Date(),
      };
    }

    await song.save();
    return song.copyrightCheck;
  } catch (error) {
    console.error(`[AudD Service] Error during copyright check for song ${songId}:`, error.message);

    const checkError = {
      checked: true,
      status: "error",
      matchedTitle: "",
      matchedArtist: "",
      matchedIsrc: "",
      matchScore: 0,
      rawResponse: { error: error.message },
      checkedAt: new Date(),
    };

    await Song.findByIdAndUpdate(songId, {
      copyrightCheck: checkError,
    });

    return checkError;
  }
};
