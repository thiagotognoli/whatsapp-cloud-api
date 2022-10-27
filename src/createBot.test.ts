import fs from 'fs';
import request from 'supertest';
import { Server } from 'http';
import { Application } from 'express';
import { createBot, Message } from '.';
import { FreeFormObject } from './utils/misc';
import { PubSubEvents } from './utils/pubSub';
import { Status } from './createBot.types';

const expectSendMessageResult = (result: any): void => {
  expect(result && typeof result === 'object').toBe(true);
  expect(result).toHaveProperty('messageId');
  expect(result).toHaveProperty('phoneNumber');
  expect(result).toHaveProperty('whatsappId');

  expect(typeof result.messageId).toBe('string');
  expect(typeof result.phoneNumber).toBe('string');
  expect(typeof result.whatsappId).toBe('string');
};

const expectSendStatusResult = (result: any): void => {
  expect(result && typeof result === 'object').toBe(true);
  expect(result).toHaveProperty('success');
  expect(typeof result.success).toBe('boolean');
  expect(result.success).toBe(false);
};

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * https://stackoverflow.com/a/1527820
 */
const getRandomInt = (_min: number, _max: number): number => {
  const min = Math.ceil(_min);
  const max = Math.floor(_max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const {
  env: {
    FROM_PHONE_NUMBER_ID: fromPhoneNumberId = '',
    ACCESS_TOKEN: accessToken = '',
    VERSION: version = '',
    TO: to = '',
    WEBHOOK_VERIFY_TOKEN: webhookVerifyToken = '',
    WEBHOOK_PATH: webhookPath = '',
  },
} = process;

describe('send functions', () => {
  const bot = createBot(fromPhoneNumberId, accessToken, { version });

  test('sends status', async () => {
    const result = await bot.sendStatus('wamid.abcde');

    expectSendStatusResult(result);
  });

  test('sends text', async () => {
    const result = await bot.sendText(to, 'Hello world', {
      preview_url: true,
    });

    expectSendMessageResult(result);
  });

  test('sends message', async () => {
    const result = await bot.sendMessage(to, 'Hello world', {
      preview_url: true,
    });

    expectSendMessageResult(result);
  });

  test('sends image', async () => {
    const result = await bot.sendImage(to, 'https://picsum.photos/200/300', {
      caption: 'Random jpg',
    });

    expectSendMessageResult(result);
  });

  test('sends document', async () => {
    const result = await bot.sendDocument(to, 'http://www.africau.edu/images/default/sample.pdf', {
      caption: 'Random pdf',
      filename: 'myfile.pdf',
    });

    expectSendMessageResult(result);
  });

  test('sends audio', async () => {
    const result = await bot.sendAudio(to, 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3');

    expectSendMessageResult(result);
  });

  test('sends video', async () => {
    const result = await bot.sendVideo(to, 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4', {
      caption: 'Random mp4',
    });

    expectSendMessageResult(result);
  });

  // TODO: not working
  // https://faq.whatsapp.com/general/how-to-create-stickers-for-whatsapp/?lang=en
  // transparent 512x512 gif
  test('sends sticker', async () => {
    const result = await bot.sendSticker(to, 'https://i.gifer.com/ZXHC.gif');

    expectSendMessageResult(result);
  });

  test('sends location', async () => {
    const result = await bot.sendLocation(to, 40.7128, -74.0060, {
      name: 'New York',
    });

    expectSendMessageResult(result);
  });

  test('sends template', async () => {
    const result = await bot.sendTemplate(to, 'hello_world', 'en_us');

    expectSendMessageResult(result);
  });

  test('sends contacts', async () => {
    const result = await bot.sendContacts(to, [{
      name: {
        formatted_name: 'John Doe',
        first_name: 'John',
      },
      phones: [{
        type: 'HOME',
        phone: '0712345678',
      }],
      emails: [{
        type: 'HOME',
        email: 'random@random.com',
      }],
    }]);

    expectSendMessageResult(result);
  });

  test('sends reply button', async () => {
    const result = await bot.sendReplyButtons(
      to,
      'Random body text',
      {
        random_id_1: 'Button 1',
        random_id_2: 'Button 2',
      },
      {
        footerText: 'Random footer text',
        header: {
          type: 'text',
          text: 'Random header text',
        },
      },
    );

    expectSendMessageResult(result);
  });

  test('sends list', async () => {
    const result = await bot.sendList(
      to,
      'Click me',
      'Random body text',
      {
        'Section 1': [
          {
            id: 'random_id_1',
            title: 'Item 1',
            description: 'Random description',
          },
          {
            id: 'random_id_2',
            title: 'Item 2',
          },
        ],
        'Section 2': [
          {
            id: 'random_id_3',
            title: 'Item 3',
          },
          {
            id: 'random_id_4',
            title: 'Item 4',
            description: 'Random description',
          },
        ],
      },
      {
        footerText: 'Random footer text',
        header: {
          type: 'text',
          text: 'Random header text',
        },
      },
    );

    expectSendMessageResult(result);
  });
});

function log(line: string) {
  fs.appendFileSync('./log.txt', `${line}\n`);
}

describe('server functions', () => {
  const bot = createBot(fromPhoneNumberId, accessToken, { version });
  let server: Server | undefined;
  let app: Application | undefined;

  beforeAll(async () => {
    log('✔️ Server is Runing');
    ({ server, app } = await bot.startExpressServer({ webhookVerifyToken }));
    log(JSON.stringify(server?.address()));
  });

  afterAll((): Promise<void> => new Promise((resolve) => {
    if (!server) {
      log('❌ Server Stopped');
      resolve();
      return;
    }

    server.close(() => {
      // eslint-disable-next-line
      console.log('✔️ Server closed');
      resolve();
    });
  }));

  test('invalid webhook token', async () => {
    const sendRequest = (path: string) => request(app)
      .get(path)
      .send()
      .expect(200);

    const paths = [
      webhookPath,
      `${webhookPath}?hub.mode=subscribe&hub.challenge=random`,
      `${webhookPath}?hub.mode=subscribe&hub.verify_token=abcd`,
      `${webhookPath}?hub.mode=sub&hub.verify_token=abcd&hub.challenge=random`,
      `${webhookPath}?hub.mode=subscribe&hub.verify_token=abcd&hub.challenge=random`,
    ];

    for (let i = 0; i < paths.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await expect(sendRequest(paths[i])).rejects.toThrow();
    }
  });

  test('verify webhook token', async () => {
    const challenge = 'random';
    log(`${webhookPath}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(webhookVerifyToken)}&hub.challenge=${challenge}`);
    const { text } = await request(app)
      .get(`${webhookPath}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(webhookVerifyToken)}&hub.challenge=${challenge}`, (data) => {
        log(data);
      })
      .send()
      .expect(200);

    expect(text).toBe(challenge);
  });

  test('send invalid body', async () => {
    const sendRequest = (data: FreeFormObject) => request(app)
      .post(webhookPath)
      .send(data)
      .expect(200);

    const data = [
      {},
      { object: 'abcd' },
      { entry: [] },
      { object: 'abcd', entry: [{ changes: [] }] },
      { object: 'abcd', entry: [{ changes: [{ value: { statuses: [] } }] }] },
    ];

    for (let i = 0; i < data.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await expect(sendRequest(data[i])).rejects.toThrow();
    }
  });

  // eslint-disable-next-line no-async-promise-executor
  test('listen for new messages', (): Promise<void> => new Promise(async (resolve, reject) => {
    const payloads = [
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'text',
        text: { body: 'Hello' },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'image',
        image: {
          mime_type: 'image/jpeg',
          sha256: 'abcd=',
          id: '1234',
        },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'document',
        document: {
          caption: 'Random pdf',
          filename: 'myfile.pdf',
          mime_type: 'application/pdf',
          sha256: 'abcd=',
          id: '1234',
        },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'audio',
        audio: {
          mime_type: 'audio/mpeg',
          sha256: 'abcd=',
          id: '1234',
          voice: false,
        },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'video',
        video: {
          mime_type: 'video/mp4',
          sha256: 'abcd=',
          id: '1234',
        },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'sticker',
        sticker: {
          mime_type: 'image/webp',
          sha256: 'abcd=',
          id: '1234',
        },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'location',
        location: { latitude: 40.7128, longitude: -74.006, name: 'New York' },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'contacts',
        contacts: [{
          name: {
            formatted_name: 'John Doe',
            first_name: 'John',
          },
          phones: [{
            type: 'HOME',
            phone: '0712345678',
          }],
          emails: [{
            type: 'HOME',
            email: 'random@random.com',
          }],
        }],
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: {
            id: 'random_id_1',
            title: 'Item 1',
            description: 'Random description',
          },
        },
        context: {
          from: '12345678',
          id: 'wamid.abcd',
        },
      },
      {
        from: '12345678',
        id: 'wamid.abcd',
        timestamp: '1640995200',
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: {
            id: 'random_id_1',
            title: 'Button 1',
          },
        },
        context: {
          from: '12345678',
          id: 'wamid.abcd',
        },
      },
    ];

    let i = 0;

    // TODO: listen for each event, e.g. bot.on('text', ...)

    bot.on('message', async (payload) => {
      expect(payload && typeof payload === 'object').toBe(true);
      expect(payload).toHaveProperty('from');
      expect(payload).toHaveProperty('id');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('type');
      expect(payload).toHaveProperty('data');
      const message: Message = payload as Message;
      expect(typeof message.from).toBe('string');
      expect(typeof message.id).toBe('string');
      expect(typeof message.timestamp).toBe('string');
      expect(typeof message.type).toBe('string');
      expect(Object.values(PubSubEvents)).toContain(message.type);

      if (message.name) {
        expect(typeof message.name).toBe('string');
      } else {
        expect(message.name === undefined).toBe(true);
      }

      expect(typeof message.data === 'object').toBe(true);
      const { data } = message;

      switch (message.type) {
        case 'text':
          expect(data).toHaveProperty('text');
          expect(typeof data.text).toBe('string');
          break;

        case 'image':
        case 'document':
        case 'audio':
        case 'video':
        case 'sticker':
          expect(data).toHaveProperty('mime_type');
          expect(data).toHaveProperty('sha256');
          expect(data).toHaveProperty('id');

          expect(typeof data.mime_type).toBe('string');
          expect(typeof data.sha256).toBe('string');
          expect(typeof data.id).toBe('string');
          if (data.caption) {
            expect(typeof data.caption).toBe('string');
          }
          if (data.filename) {
            expect(typeof data.filename).toBe('string');
          }
          if (data.voice) {
            expect(typeof data.voice).toBe('boolean');
          }
          break;

        case 'location':
          expect(data).toHaveProperty('latitude');
          expect(data).toHaveProperty('longitude');

          expect(typeof data.latitude).toBe('number');
          expect(typeof data.longitude).toBe('number');
          if (data.name) {
            expect(typeof data.name).toBe('string');
          }
          if (data.address) {
            expect(typeof data.address).toBe('string');
          }
          break;

        case 'contacts':
          expect(Array.isArray(data)).toBe(true);
          data.forEach((item: FreeFormObject) => expect(typeof item === 'object').toBe(true));
          break;

        case 'list_reply':
        case 'button_reply':
          expect(data).toHaveProperty('id');
          expect(data).toHaveProperty('title');
          expect(data).toHaveProperty('context');

          expect(typeof data.id).toBe('string');
          expect(typeof data.title).toBe('string');
          if (data.description) {
            expect(typeof data.description).toBe('string');
          }

          expect(typeof data.context === 'object').toBe(true);
          expect(data.context).toHaveProperty('from');
          expect(data.context).toHaveProperty('id');

          expect(typeof data.context.from).toBe('string');
          expect(typeof data.context.id).toBe('string');
          break;

        default:
          break;
      }

      i += 1;

      if (i === payloads.length) {
        resolve();
      }
    });

    try {
      Object.values(payloads).map(async (payload) => {
        await request(app)
          .post(webhookPath)
          .send({
            object: 'abcd',
            entry: [{
              changes: [{
                value: {
                  messages: [payload],
                  contacts: [{
                    profile: {
                      name: getRandomInt(0, 1) ? 'John Doe' : undefined,
                    },
                  }],
                },
              }],
            }],
          })
          .expect(200);
      });
    } catch (err) {
      reject(err);
    }
  }));

  // eslint-disable-next-line no-async-promise-executor, @typescript-eslint/no-unused-vars
  test('listen for statuses', (): Promise<void> => new Promise(async (resolve, reject) => {
    const payloads = [
      {
        id: 'wamid.abcdef',
        status: 'failed',
        timestamp: '123456789',
        recipient_id: '123456789',
        errors: [
          {
            code: 131047,
            title:
              'Message failed to send because more than 24 hours have passed since the customer last replied to this number.',
            href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/',
          },
        ],
      },
      {
        id: 'wamid.abcdefg',
        status: 'sent',
        timestamp: '1666677821',
        recipient_id: '123456789',
        conversation: {
          id: 'aasdf',
          expiration_timestamp: '1666751460',
          origin: {
            type: 'user_initiated',
          },
        },
        pricing: {
          billable: true,
          pricing_model: 'CBP',
          category: 'user_initiated',
        },
      },
      {
        id: 'wamid.abcdefgh',
        status: 'delivered',
        timestamp: '1666677822',
        recipient_id: '12345',
        conversation: {
          id: '7d66bebf4fba8680d9808180c7b0d9e6',
          origin: {
            type: 'user_initiated',
          },
        },
        pricing: {
          billable: true,
          pricing_model: 'CBP',
          category: 'user_initiated',
        },
      },
      {
        id: 'wamid.abcdefghi',
        status: 'read',
        timestamp: '1666677867',
        recipient_id: '123123123123',
      },
    ];
    let i = 0;
    bot.on('status', async (payload) => {
      log(JSON.stringify(payload, null, 1));
      expect(payload && typeof payload === 'object').toBe(true);
      expect(payload).toHaveProperty('id');
      expect(payload).toHaveProperty('status');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('recipient_id');
      const status: Status = payload as Status;
      expect(typeof status.id).toBe('string');
      expect(typeof status.status).toBe('string');
      expect(typeof status.timestamp).toBe('string');
      expect(typeof status.recipient_id).toBe('string');
      expect(Object.values(PubSubEvents)).toContain(status.status);
      if (status.errors) {
        status.errors.forEach((e) => {
          expect(typeof e.title).toBe('string');
          expect(typeof e.code).toBe('number');
        });
      }
      switch (status.status) {
        case 'read':
          expect(status.status).toBe('read');
          break;
        case 'sent':
          expect(status.status).toBe('sent');
          expect(status).toHaveProperty('conversation');
          expect(typeof status.conversation!.id).toBe('string');
          expect(typeof status.conversation!.expiration_timestamp).toBe('string');
          expect(status.conversation).toHaveProperty('origin');
          expect(status).toHaveProperty('pricing');
          expect(typeof status.pricing!.billable).toBe('boolean');
          expect(typeof status.pricing!.pricing_model).toBe('string');
          expect(typeof status.pricing!.category).toBe('string');
          break;
        case 'delivered':
          expect(status.status).toBe('delivered');
          expect(status).toHaveProperty('conversation');
          expect(typeof status.conversation!.id).toBe('string');
          expect(status.conversation).toHaveProperty('origin');
          expect(status).toHaveProperty('pricing');
          expect(typeof status.pricing!.billable).toBe('boolean');
          expect(typeof status.pricing!.pricing_model).toBe('string');
          expect(typeof status.pricing!.category).toBe('string');
          break;
        case 'failed':
          expect(status.status).toBe('failed');
          expect(status).toHaveProperty('errors');
          expect(Array.isArray(status.errors)).toBe(true);
          expect(status.errors?.[0]).toHaveProperty('code');
          expect(status.errors?.[0]).toHaveProperty('title');
          expect(typeof status.errors?.[0].code).toBe('number');
          expect(typeof status.errors?.[0].title).toBe('string');
          break;
        default:
          break;
      }
      i += 1;
      if (i === payloads.length) {
        resolve();
      }
    });
    try {
      Object.values(payloads).map(async (payload) => {
        log(JSON.stringify(payload, null, 1));
        await request(app)
          .post(webhookPath)
          .send({
            object: 'abcd',
            entry: [{
              changes: [{
                value: {
                  statuses: [payload],
                },
              }],
            }],
          }).expect(200);
      });
    } catch (error) {
      reject(error);
    }
  }));
});
