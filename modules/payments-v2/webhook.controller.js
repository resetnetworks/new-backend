import WebhookEventModel from "./persistence/webhookEvent.model.js";
import { enqueueWebhookJob } from "./queue/webhook.queue.js";
import { getProviderAdapter } from "./providers/providerFactory.js";

export const handleWebhook = async (req, res) => {
  try {
    
    const provider = req.params.provider;

    if (!provider) {
      return res.status(400).json({ message: "Provider is required" });
    }

    const adapter = getProviderAdapter(provider);

    // 1️⃣ Verify signature
    const isValid = adapter.verifySignature(req);

    // if (!isValid) {
    //   return res.status(400).json({ message: "Invalid signature" });
    // }

    const rawPayload = req.body;
    const headers = req.headers;

    // 2️⃣ Extract provider event ID
    const eventId = adapter.extractEventId(rawPayload);
    const eventType = adapter.extractEventType(rawPayload);

    // 3️⃣ Store webhook event (idempotent)
    const webhookEvent = await WebhookEventModel.create({
      provider,
      eventId,
      eventType,
      rawPayload,
      headers,
    }).catch((err) => {
      // Duplicate event → already stored
      if (err.code === 11000) {
        return null;
      }
      throw err;
    });
    console.log("#####################Webhook event stored:",webhookEvent);

    // 4️⃣ Enqueue job if newly created
    if (webhookEvent) {
      console.log("🔥 enqueueWebhookJob about to be called");
      await enqueueWebhookJob(webhookEvent._id.toString());
    }

    // 5️⃣ Always return 200 to provider
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Webhook controller error:", err);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};
