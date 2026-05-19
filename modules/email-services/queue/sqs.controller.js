import { publishEmailEvent } from "./sqsProducer.service.js";

// sqs.controller.js
export const testSQS = async (req, res) => {
  await publishEmailEvent({
    type: "FORCE_FAIL", // 👈 fake event type
    payload: {
      email: "fail@test.com",
      userName: "Poison Message",
    },
  });

  res.send("Failing Event sent to SQS");
};