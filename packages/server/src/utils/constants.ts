/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: constants.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import {
  EXT_WEBM,
  MessageType,
  RECORD_VIDEOS_PATH,
  SendMessageArgs,
  TEMPORARY_PATH,
} from '../types/interfaces';

export const LOG_LEVEL = parseInt(process.env.LOG_LEVEL as string, 10);
export const DEFAULT_PORT = '3001';
export const HEADLESS = true;
export const VIEWPORT = {
  width: 1920,
  height: 1080,
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
    RECORD_DIR_PATH?: string;
  };
} = process as any;

export const PORT = parseInt(env.PORT || DEFAULT_PORT, 10);
export const DATABASE_URL = env.DATABASE_URL || '';
export const CLOUD_DIR_PATH = env.CLOUD_DIR_PATH || '';
export const CORS = env.CORS || '';
export const APP_URL = env.APP_URL || '';
export const STUN_SERVER = env.STUN_SERVER || 'stun:127.0.0.1:3478';
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
export const IS_DEV = process.env.NODE_ENV === 'development';
export const IS_CI = process.env.CI === 'true';
export const ICE_PORT_MIN = parseInt(process.env.ICE_PORT_MIN as string, 10);
export const ICE_PORT_MAX = parseInt(process.env.ICE_PORT_MAX as string, 10);
export const RECORD_WIDTH_DEFAULT = 640;
export const RECORD_HEIGHT_DEFAULT = 480;
export const AUTH_UNIT_ID_DEFAULT = 'default';
export const VIDEO_REGEX = new RegExp(`^/${RECORD_VIDEOS_PATH}/`);
export const TMP_REGEX = new RegExp(`^/${TEMPORARY_PATH}/`);
export const WEBM_REGEX = new RegExp(`${EXT_WEBM}$`);
