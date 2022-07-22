/******************************************************************************************
 * Repository: https://github.com/kolserdav/react-node-webrtc-sfu.git
 * File name: ws.ts
 * Author: Sergey Kolmiller
 * Email: <uyem.ru@gmail.com>
 * License: MIT
 * License text:
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Thu Jul 14 2022 16:24:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import * as Types from '../types/interfaces';
import { log } from '../utils/lib';

class WS implements Types.WSInterface {
  public connection: WebSocket;

  userId: number | string = 0;

  public readonly delimiter = '_';

  public setUserId(userId: number | string) {
    this.userId = userId;
  }

  // eslint-disable-next-line class-methods-use-this
  public onOpen: (ev: Event) => void = () => {
    /** */
  };

  // eslint-disable-next-line class-methods-use-this
  public onMessage: (ev: MessageEvent<any>) => void = () => {
    /** */
  };

  // eslint-disable-next-line class-methods-use-this
  public onClose: (ev: CloseEvent) => void = () => {
    /** */
  };

  // eslint-disable-next-line class-methods-use-this
  public onError: (ev: Event) => void = () => {
    /** */
  };

  public sendMessage: Types.WSInterface['sendMessage'] = (args) =>
    new Promise((resolve) => {
      let res = '';
      try {
        res = JSON.stringify(args);
      } catch (e) {
        log('error', 'sendMessage', e);
        resolve(1);
      }
      log('log', 'sendMessage', res);
      this.connection.send(res);
      resolve(0);
    });

  // eslint-disable-next-line class-methods-use-this
  public parseMessage: Types.WSInterface['parseMessage'] = (message) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (err) {
      log('error', 'parseMessage', err);
      return null;
    }
    return data;
  };

  // eslint-disable-next-line class-methods-use-this
  public getMessage: Types.WSInterface['getMessage'] = (type, data) => data as any;

  private newConnection({ port, local = false }: { port: string; local?: boolean }): WebSocket {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let connection: any;
    if (typeof window !== 'undefined') {
      connection = new WebSocket(`ws://localhost:${port}`, 'json');
    }
    if (!local && connection !== null) {
      this.connection = connection;
    }
    return connection;
  }

  public createConnection({ port }: { port: string }) {
    this.newConnection({ port });
    this.connection.onopen = (ev: Event) => {
      log('log', 'onOpen', ev);
      this.onOpen(ev);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.connection.onmessage = (ev: MessageEvent<any>) => {
      log('log', 'onMessage', ev.data);
      this.onMessage(ev);
    };
    this.connection.onerror = (ev: Event) => {
      this.onError(ev);
    };
    this.connection.onclose = (ev: CloseEvent) => {
      this.onClose(ev);
    };
    return this.connection;
  }

  constructor({ port }: { port: string }) {
    this.connection = this.createConnection({ port });
  }
}

export default WS;
