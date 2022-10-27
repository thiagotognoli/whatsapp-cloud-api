import axios, { AxiosError } from 'axios';

// https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
interface OfficialSendStatusResult {
  success: boolean;
}

export interface SendStatusResult {
  success: boolean;
}

export const sendStatusHelper = (
  fromPhoneNumberId: string,
  accessToken: string,
  version: string = 'v14.0',
) => async <T>(data: T): Promise<SendStatusResult> => {
  try {
    const { data: rawResult } = await axios({
      method: 'post',
      url: `https://graph.facebook.com/${version}/${fromPhoneNumberId}/messages`,
      data,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const result = rawResult as OfficialSendStatusResult;

    return {
      success: result.success,
    };
  } catch (err: unknown) {
    if ((err as any).response) {
      throw (err as AxiosError)?.response?.data;
    // } else if ((err as any).request) {
    //   throw (err as AxiosError)?.request;
    } else if (err instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw (err as Error).message;
    } else {
      throw err;
    }
  }
};
