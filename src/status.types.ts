// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

export interface Status {
  messaging_product: 'whatsapp';
  status: 'read';
  message_id: string;
}
