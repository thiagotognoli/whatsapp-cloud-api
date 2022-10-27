import express, { Application } from 'express';
import { Server } from 'http';
import PubSub from 'pubsub-js';
import { FreeFormObject } from './utils/misc';
import { PubSubEvent, PubSubEvents } from './utils/pubSub';
import { Message } from './createBot.types';

export interface ServerOptions {
  app?: Application;
  useMiddleware?: (app: Application) => void;
  port?: number;
  webhookPath?: string;
  webhookVerifyToken?: string;
}

export interface ExpressServer {
  server?: Server;
  app: Application;
}

export const startExpressServer = (
  options?: ServerOptions,
): Promise<ExpressServer> => new Promise((resolve) => {
  const app = options?.app || express();

  app.use(express.json());

  if (options?.useMiddleware) {
    options.useMiddleware(app);
  }

  const webhookPath = options?.webhookPath || '/webhook/whatsapp';

  if (options?.webhookVerifyToken) {
    app.get(webhookPath, (req, res) => {
      if (!req.query) {
        res.sendStatus(403);
        return;
      }

      const mode = req.query['hub.mode'];
      const verifyToken = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (!mode || !verifyToken || !challenge) {
        res.sendStatus(403);
        return;
      }

      if (mode === 'subscribe' && verifyToken === options.webhookVerifyToken) {
        // eslint-disable-next-line no-console
        console.log('✔️ Webhook verified');
        res.setHeader('content-type', 'text/plain');
        res.send(challenge);
        return;
      }

      res.sendStatus(403);
    });
  }

  app.post(webhookPath, async (req, res) => {
    if (!req.body.object || !req.body.entry?.[0]?.changes?.[0]?.value) {
      res.sendStatus(400);
      return;
    }
    if (req.body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]) {
      // console.log('statuses_express');
      const {
        id,
        status,
        timestamp,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        recipient_id,
        ...rest
      } = req.body.entry[0].changes[0].value.statuses[0];
      let event: PubSubEvent | undefined;
      let errors: FreeFormObject[] | undefined;
      let conversation: FreeFormObject | undefined;
      let pricing: FreeFormObject | undefined;
      switch (status) {
        case 'read':
          event = PubSubEvents.read;
          break;
        case 'sent':
          event = PubSubEvents.sent;
          conversation = rest.conversation;
          pricing = rest.pricing;
          break;
        case 'delivered':
          event = PubSubEvents.delivered;
          conversation = rest.conversation;
          pricing = rest.pricing;
          break;
        case 'failed':
          event = PubSubEvents.failed;
          errors = rest.errors;
          break;
        default:
          break;
      }
      if (event) {
        let payload:FreeFormObject = {
          id,
          status,
          timestamp,
          recipient_id,
        };
        if (errors) { payload = { ...payload, errors }; }
        if (conversation) { payload = { ...payload, conversation }; }
        if (pricing) { payload = { ...payload, pricing }; }
        ['status', event].forEach((e) => PubSub.publish(e, payload));
      }
      res.sendStatus(200);
      return;
    }
    if (req.body?.entry?.[0]?.changes?.[0]?.value?.messages) {
      const {
        from,
        id,
        timestamp,
        type,
        ...rest
      } = req.body.entry[0].changes[0].value.messages[0];
      let event: PubSubEvent | undefined;
      let data: FreeFormObject | undefined;
      switch (type) {
        case 'text':
          event = PubSubEvents.text;
          data = { text: rest.text?.body };
          break;
        case 'image':
        case 'document':
        case 'audio':
        case 'video':
        case 'sticker':
        case 'location':
        case 'contacts':
          event = PubSubEvents[type as PubSubEvent];
          data = rest[type];
          break;
        case 'interactive':
          event = rest.interactive.type;
          data = {
            ...(rest.interactive.list_reply || rest.interactive.button_reply),
          };
          break;
        default:
          break;
      }
      if (rest.context) {
        data = {
          ...data,
          context: rest.context,
        };
      }
      const name = req.body.entry[0].changes[0].value.contacts?.[0]?.profile?.name ?? undefined;
      if (event && data) {
        const payload: Message = {
          from,
          name,
          id,
          timestamp,
          type: event,
          data,
        };
        ['message', event].forEach((e) => PubSub.publish(e, payload));
      }
      res.sendStatus(200);
      return;
    }
    res.sendStatus(400);
  });

  if (options?.app) {
    resolve({ app });
    return;
  }

  const port = options?.port || 3000;
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Server running on port ${port}...`);
    resolve({ server, app });
  });
});
