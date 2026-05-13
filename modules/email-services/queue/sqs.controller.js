import { publishEmailEvent } from "./sqsProducer.service.js";

export const testSQS = async (req, res) => {
  await publishEmailEvent({
    type: "WELCOME",
    payload: {
      email: "your@email.com",
      userName: "Raman",
    },
  });

  res.send("Event sent to SQS");
};