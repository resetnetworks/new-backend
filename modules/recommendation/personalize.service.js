import fs from "fs";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  PersonalizeRuntimeClient,
  GetRecommendationsCommand,
} from "@aws-sdk/client-personalize-runtime";

import {
  PersonalizeClient,
  CreateDatasetImportJobCommand,
} from "@aws-sdk/client-personalize";

/* =========================================
   CONFIG
========================================= */

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.PERSONALIZE_BUCKET;
const CAMPAIGN_ARN = process.env.PERSONALIZE_CAMPAIGN_ARN;
const DATASET_ARN = process.env.PERSONALIZE_INTERACTIONS_DATASET_ARN;

const s3 = new S3Client({ region: REGION });
const personalizeRuntime = new PersonalizeRuntimeClient({ region: REGION });
const personalize = new PersonalizeClient({ region: REGION });

/* =========================================
   Upload file to S3
========================================= */
export const uploadToS3 = async (filePath, key) => {
  const fileStream = fs.createReadStream(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileStream,
    })
  );

  return `s3://${BUCKET}/${key}`;
};

/* =========================================
   Create Dataset Import Job
========================================= */
export const createDatasetImportJob = async ({
  jobName,
  datasetArn,
  s3Path,
  roleArn,
}) => {
  return personalize.send(
    new CreateDatasetImportJobCommand({
      jobName,
      datasetArn,
      dataSource: {
        dataLocation: s3Path,
      },
      roleArn,
    })
  );
};

/* =========================================
   Get Recommendations (Real-Time)
========================================= */
export const getRecommendations = async ({
  userId,
  numResults = 20,
}) => {
  const response = await personalizeRuntime.send(
    new GetRecommendationsCommand({
      campaignArn: CAMPAIGN_ARN,
      userId,
      numResults,
    })
  );

  return response.itemList.map((item) => item.itemId);
};