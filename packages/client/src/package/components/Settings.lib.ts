/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: Settings.lib.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/

import { EXT_WEBM, RECORD_VIDEOS_PATH, TOKEN_QUERY_NAME } from '../types/interfaces';

export const getVideoSrc = ({
  port,
  server,
  name,
  roomId,
  token,
}: {
  port: number;
  server: string;
  name: string;
  roomId: string | number;
  token: string;
}) => {
  let protocol = 'http:';
  if (typeof window !== 'undefined') {
    protocol = window.location.protocol;
  }
  return `${protocol}//${server}:${port}/${RECORD_VIDEOS_PATH}/${name}?${TOKEN_QUERY_NAME}=${token}`;
};

export const getVideoNameWithoutExt = (name: string) =>
  name.replace(new RegExp(`${EXT_WEBM}$`), '');

export const getFullVideoName = (name: string) => `${name}${EXT_WEBM}`;

export const deleteLastSymbol = (str: string) => {
  let res = '';
  for (let i = 0; i < str.length - 1; i++) {
    res += str[i];
  }
  return res;
};
