import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Auto-register Telegram Webhook in production on Render
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (botToken && externalUrl) {
    const webhookUrl = `${externalUrl.replace(/\/+$/, "")}/api/telegram-webhook`;
    fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`)
      .then((res) => res.json())
      .then((data: any) => {
        if (data.ok) {
          logger.info(`Telegram Webhook auto-registered successfully: ${webhookUrl}`);
        } else {
          logger.error(`Failed to auto-register Telegram Webhook: ${JSON.stringify(data)}`);
        }
      })
      .catch((err) => logger.error(`Error auto-registering Telegram Webhook: ${err.message}`));
  }
});
