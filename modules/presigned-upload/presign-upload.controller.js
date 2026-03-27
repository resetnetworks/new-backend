// controllers/presignUpload.controller.js
import { StatusCodes } from "http-status-codes";
import {
  presignSongUploadService,
  presignCoverImageUploadService,
  presignProfileImageUploadService
} from "./presign-upload.service.js";

export const presignSongUpload = async (req, res) => {
  const result = await presignSongUploadService(req.body);
  res.status(StatusCodes.OK).json(result);
};

export const presignCoverImageUpload = async (req, res) => {
  const result = await presignCoverImageUploadService(req.body);
  res.status(StatusCodes.OK).json(result);
};

export const presignProfileImageUpload = async (req, res) => {
  const result = await presignProfileImageUploadService(req.body);
  res.status(StatusCodes.OK).json(result);
};