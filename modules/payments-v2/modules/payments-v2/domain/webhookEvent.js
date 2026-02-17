export const WebhookStatus = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
});

export class WebhookEvent {
  constructor(props) {
    const {
      id,
      provider,
      eventId,
      eventType,
      rawPayload,
      headers = {},
      status = WebhookStatus.PENDING,
      attempts = 0,
      lastError = null,
      receivedAt = new Date(),
      processedAt = null,
    } = props;

    if (!provider) throw new Error("WebhookEvent: provider is required");
    if (!eventId) throw new Error("WebhookEvent: eventId is required");
    if (!rawPayload) throw new Error("WebhookEvent: rawPayload is required");

    this.id = id;
    this.provider = provider;
    this.eventId = eventId;
    this.eventType = eventType;
    this.rawPayload = rawPayload;
    this.headers = headers;
    this.status = status;
    this.attempts = attempts;
    this.lastError = lastError;
    this.receivedAt = receivedAt;
    this.processedAt = processedAt;
  }

  markProcessing() {
    this.status = WebhookStatus.PROCESSING;
    this.attempts += 1;
  }

  markProcessed() {
    this.status = WebhookStatus.PROCESSED;
    this.processedAt = new Date();
  }

  markFailed(errorMessage) {
    this.status = WebhookStatus.FAILED;
    this.lastError = errorMessage;
  }

  canRetry(maxAttempts = 5) {
    return this.attempts < maxAttempts;
  }
}
