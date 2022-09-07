/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: constants.ts
 * Author: Sergey Kolmiller
 * Email: <uyem.ru@gmail.com>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 24 2022 14:14:09 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import { MessageType, SendMessageArgs } from '../types/interfaces';

export const LOG_LEVEL = 2;
export const DEFAULT_PORT = '3001';
export const HEADLESS = true;
export const VIEWPORT = {
  width: 800,
  height: 400,
};

const {
  env,
}: {
  env: NodeJS.ProcessEnv & {
    PORT?: string;
    DATABASE_URL?: string;
    CORS?: string;
    APP_URL?: string;
    STUN_SERVER?: string;
    CERT_PEM?: string;
    KEY_PEM?: string;
  };
} = process as any;

export const PORT = parseInt(env.PORT || DEFAULT_PORT, 10);
export const DATABASE_URL = env.DATABASE_URL || '';
export const CORS = env.CORS || '';
export const APP_URL = env.APP_URL || '';
export const STUN_SERVER = env.STUN_SERVER || '';
export const SENT_RTCP_INTERVAL = 1000;
export const STOP_RECORDING_MESSAGE: SendMessageArgs<MessageType.SET_RECORDING> = {
  type: MessageType.SET_RECORDING,
  id: 0,
  connId: '',
  data: {
    time: 0,
    command: 'stop',
  },
};
export const CERT_PEM = env.CERT_PEM as string;
export const KEY_PEM = env.KEY_PEM as string;
