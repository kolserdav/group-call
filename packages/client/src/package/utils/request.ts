/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: request.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import { TEMPORARY_PATH, TOKEN_QUERY_NAME } from '../types/interfaces';
import { log } from './lib';

class Request {
  port: number;

  server: string;

  protocol: string;

  constructor({ port, server }: { port: number; server: string }) {
    this.port = port;
    this.server = server;
    this.protocol = `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//`;
  }

  // eslint-disable-next-line class-methods-use-this
  private async send<T>({
    responseType,
    token,
    url,
  }: {
    url: string;
    token?: string;
    responseType?: XMLHttpRequest['responseType'];
  }): Promise<1 | T> {
    return new Promise((resolve) => {
      const req = new XMLHttpRequest();
      req.responseType = 'json' || responseType;
      req.onload = () => {
        resolve(req.response as T);
      };
      req.onabort = () => {
        log('error', 'Request abort', { url });
        resolve(1);
      };
      req.onerror = (e) => {
        log('error', 'Request error', e);
        resolve(1);
      };
      req.open('GET', `${this.getOrigin()}${url}?${TOKEN_QUERY_NAME}=${token}`);
      req.send();
    });
  }

  public getOrigin() {
    return `${this.protocol}${this.server}:${this.port}`;
  }

  // eslint-disable-next-line class-methods-use-this
  public getTmpPath({ dirName }: { dirName: string }) {
    return `/${TEMPORARY_PATH}/${dirName}`;
  }

  public async getTmpDir({ dirName, token }: { dirName: string; token: string }) {
    return this.send<string[]>({
      url: this.getTmpPath({ dirName }),
      token,
    });
  }
}

export default Request;
