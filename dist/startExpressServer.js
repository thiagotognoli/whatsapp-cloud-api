"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startExpressServer = void 0;
const express_1 = __importDefault(require("express"));
const pubsub_js_1 = __importDefault(require("pubsub-js"));
const pubSub_1 = require("./utils/pubSub");
const startExpressServer = (options) => new Promise((resolve) => {
    const app = (options === null || options === void 0 ? void 0 : options.app) || (0, express_1.default)();
    app.use(express_1.default.json());
    if (options === null || options === void 0 ? void 0 : options.useMiddleware) {
        options.useMiddleware(app);
    }
    const webhookPath = (options === null || options === void 0 ? void 0 : options.webhookPath) || '/webhook/whatsapp';
    if (options === null || options === void 0 ? void 0 : options.webhookVerifyToken) {
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
                console.log('✔️ Webhook verified');
                res.setHeader('content-type', 'text/plain');
                res.send(challenge);
                return;
            }
            res.sendStatus(403);
        });
    }
    app.post(webhookPath, async (req, res) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        if (!req.body.object || !((_d = (_c = (_b = (_a = req.body.entry) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.changes) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value)) {
            res.sendStatus(400);
            return;
        }
        if ((_l = (_k = (_j = (_h = (_g = (_f = (_e = req.body) === null || _e === void 0 ? void 0 : _e.entry) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.changes) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.statuses) === null || _l === void 0 ? void 0 : _l[0]) {
            const { id, status, timestamp, recipient_id, ...rest } = req.body.entry[0].changes[0].value.statuses[0];
            let event;
            let errors;
            let conversation;
            let pricing;
            switch (status) {
                case 'read':
                    event = pubSub_1.PubSubEvents.read;
                    break;
                case 'sent':
                    event = pubSub_1.PubSubEvents.sent;
                    conversation = rest.conversation;
                    pricing = rest.pricing;
                    break;
                case 'delivered':
                    event = pubSub_1.PubSubEvents.delivered;
                    conversation = rest.conversation;
                    pricing = rest.pricing;
                    break;
                case 'failed':
                    event = pubSub_1.PubSubEvents.failed;
                    errors = rest.errors;
                    break;
                default:
                    break;
            }
            if (event) {
                let payload = {
                    id,
                    status,
                    timestamp,
                    recipient_id,
                };
                if (errors) {
                    payload = { ...payload, errors };
                }
                if (conversation) {
                    payload = { ...payload, conversation };
                }
                if (pricing) {
                    payload = { ...payload, pricing };
                }
                ['status', event].forEach((e) => pubsub_js_1.default.publish(e, payload));
            }
            res.sendStatus(200);
            return;
        }
        if ((_s = (_r = (_q = (_p = (_o = (_m = req.body) === null || _m === void 0 ? void 0 : _m.entry) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.changes) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.value) === null || _s === void 0 ? void 0 : _s.messages) {
            const { from, id, timestamp, type, ...rest } = req.body.entry[0].changes[0].value.messages[0];
            let event;
            let data;
            switch (type) {
                case 'text':
                    event = pubSub_1.PubSubEvents.text;
                    data = { text: (_t = rest.text) === null || _t === void 0 ? void 0 : _t.body };
                    break;
                case 'image':
                case 'document':
                case 'audio':
                case 'video':
                case 'sticker':
                case 'location':
                case 'contacts':
                    event = pubSub_1.PubSubEvents[type];
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
            const name = (_x = (_w = (_v = (_u = req.body.entry[0].changes[0].value.contacts) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.profile) === null || _w === void 0 ? void 0 : _w.name) !== null && _x !== void 0 ? _x : undefined;
            if (event && data) {
                const payload = {
                    from,
                    name,
                    id,
                    timestamp,
                    type: event,
                    data,
                };
                ['message', event].forEach((e) => pubsub_js_1.default.publish(e, payload));
            }
            res.sendStatus(200);
            return;
        }
        res.sendStatus(400);
    });
    if (options === null || options === void 0 ? void 0 : options.app) {
        resolve({ app });
        return;
    }
    const port = (options === null || options === void 0 ? void 0 : options.port) || 3000;
    const server = app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}...`);
        resolve({ server, app });
    });
});
exports.startExpressServer = startExpressServer;
//# sourceMappingURL=startExpressServer.js.map