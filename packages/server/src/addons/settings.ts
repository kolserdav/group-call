/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: settings.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
// eslint-disable-next-line max-classes-per-file
import fs, { readdirSync } from 'fs';
import { ConnectorInterface } from '../types';
import { MessageType, SendMessageArgs, ErrorCode } from '../types/interfaces';
import {
  log,
  getLocale,
  getVideoPath,
  getVideosDirPath,
  getRoomDirPath,
  checkDefaultAuth,
} from '../utils/lib';
import DB from '../core/db';

class Settings extends DB implements ConnectorInterface {
  public users: ConnectorInterface['users'] = {};

  private cloudPath: string;

  constructor({ cloudPath, prisma }: { cloudPath: string; prisma: DB['prisma'] }) {
    super({ prisma });
    this.cloudPath = cloudPath;
  }

  public setUnit: ConnectorInterface['setUnit'] = ({ roomId, userId, ws, locale, connId }) => {
    const lang = getLocale(locale).server;
    if (!this.users[roomId]) {
      this.users[roomId] = {};
    }
    if (this.users[roomId][userId]) {
      log('warn', 'Duplicate settings user', { roomId, userId });
    }
    this.users[roomId][userId] = {
      locale,
      ws,
      connId,
    };
    if (checkDefaultAuth({ unitId: userId.toString() })) {
      this.sendMessage(
        {
          roomId,
          msg: {
            id: userId,
            connId,
            type: MessageType.SET_ERROR,
            data: {
              type: 'warn',
              message: lang.notAuthorised,
              code: ErrorCode.notAuthorised,
            },
          },
        },
        () => {
          delete this.users[roomId][userId];
        }
      );
      return;
    }
    this.sendMessage({
      roomId,
      msg: {
        id: userId,
        connId,
        type: MessageType.SET_SETTINGS_UNIT,
        data: undefined,
      },
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public sendMessage: ConnectorInterface['sendMessage'] = ({ msg, roomId }, cb) => {
    const { id } = msg;
    return new Promise((resolve) => {
      setTimeout(() => {
        let res = '';
        try {
          res = JSON.stringify(msg);
        } catch (e) {
          log('error', 'Error send settings message', e);
          resolve(1);
        }
        if (!this.users[roomId][id]) {
          log('warn', 'Settings user not found', { roomId, id });
          resolve(1);
          return;
        }
        this.users[roomId][id].ws.send(res, cb);
        resolve(0);
      }, 0);
    });
  };

  public cleanUnit: ConnectorInterface['cleanUnit'] = ({ roomId, userId }) => {
    if (!this.users[roomId][userId]) {
      log('warn', 'Settings user can not remove', { roomId, userId });
      return;
    }
    delete this.users[roomId][userId];
  };

  private getLocale({ userId, roomId }: { userId: string | number; roomId: string | number }) {
    return getLocale(this.users[roomId][userId].locale).server;
  }

  public async videoFindManyHandler({
    id,
    data: { args, userId, token },
    connId,
  }: SendMessageArgs<MessageType.GET_VIDEO_FIND_MANY>) {
    const locale = this.getLocale({ roomId: id, userId });
    const { errorCode, unitId } = await this.checkTokenCb({ token });
    const isDefault = checkDefaultAuth({ unitId });
    if (errorCode !== 0 && !isDefault) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.forbidden,
            code: ErrorCode.forbidden,
          },
        },
      });
      return;
    }
    if (!isDefault && userId.toString() !== unitId) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notAuthorised,
            code: ErrorCode.notAuthorised,
          },
        },
      });
      return;
    }
    const videos = await this.videoFindMany({ ...args });
    if (videos === undefined) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'error',
            message: locale.serverError,
            code: ErrorCode.serverError,
          },
        },
      });
      return;
    }
    this.sendMessage({
      roomId: id,
      msg: {
        type: MessageType.SET_VIDEO_FIND_MANY,
        id: userId,
        connId,
        data: {
          videos,
        },
      },
    });
  }

  public async videoFindFirstHandler({
    id,
    data: { args, userId, token },
    connId,
  }: SendMessageArgs<MessageType.GET_VIDEO_FIND_MANY>) {
    const locale = this.getLocale({ roomId: id, userId });
    const { errorCode, unitId } = await this.checkTokenCb({ token });
    const isDefault = checkDefaultAuth({ unitId });
    if (errorCode !== 0 && !isDefault) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.forbidden,
            code: ErrorCode.forbidden,
          },
        },
      });
      return;
    }
    if (!isDefault && userId.toString() !== unitId) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notAuthorised,
            code: ErrorCode.notAuthorised,
          },
        },
      });
      return;
    }
    const video = await this.videoFindFirst({ ...args });
    if (video === undefined) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'error',
            message: locale.serverError,
            code: ErrorCode.serverError,
          },
        },
      });
      return;
    }
    this.sendMessage({
      roomId: id,
      msg: {
        type: MessageType.SET_VIDEO_FIND_FIRST,
        id: userId,
        connId,
        data: {
          video,
        },
      },
    });
  }

  public async videoDeleteHandler({
    id,
    data: { args, userId, token },
    connId,
  }: SendMessageArgs<MessageType.GET_VIDEO_DELETE>) {
    const locale = this.getLocale({ roomId: id, userId });
    const { errorCode, unitId } = await this.checkTokenCb({ token });
    const isDefault = checkDefaultAuth({ unitId });
    // TODO refactor checks to one auth method
    if (errorCode !== 0 && !isDefault) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.forbidden,
            code: ErrorCode.forbidden,
          },
        },
      });
      return;
    }
    if (!isDefault && userId.toString() !== unitId) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notAuthorised,
            code: ErrorCode.notAuthorised,
          },
        },
      });
      return;
    }
    if (!args.where.id) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.badRequest,
            code: ErrorCode.badRequest,
          },
        },
      });
      return;
    }
    const _video = await this.videoFindFirst({
      where: {
        id: args.where.id,
      },
      include: {
        Room: {
          select: {
            id: true,
            authorId: true,
          },
        },
      },
    });
    if (_video === undefined) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'error',
            message: locale.serverError,
            code: ErrorCode.serverError,
          },
        },
      });
      return;
    }
    if (_video === null) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notFound,
            code: ErrorCode.notFound,
          },
        },
      });
      return;
    }
    if (userId.toString() !== _video.Room.authorId || id.toString() !== _video.Room.id) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notAuthorised,
            code: ErrorCode.notAuthorised,
          },
        },
      });
      return;
    }
    const video = await this.videoDelete({ ...args });
    if (video === undefined) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'error',
            message: locale.serverError,
            code: ErrorCode.serverError,
          },
        },
      });
      return;
    }
    if (video === null) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notFound,
            code: ErrorCode.notFound,
          },
        },
      });
      return;
    }

    const videoPath = getVideoPath({ cloudPath: this.cloudPath, roomId: id, name: video.name });
    fs.rmSync(videoPath);
    const videosDirPath = getVideosDirPath({ cloudPath: this.cloudPath });
    const roomDirPath = getRoomDirPath({ videosDirPath, roomId: id });
    const dir = readdirSync(roomDirPath);
    if (dir.length === 0) {
      fs.rmSync(roomDirPath, { recursive: true, force: true });
    }

    this.sendMessage({
      roomId: id,
      msg: {
        type: MessageType.SET_VIDEO_DELETE,
        id: userId,
        connId,
        data: {
          video,
        },
      },
    });
  }

  public async videoUpdateHandler({
    id,
    data: { args, userId, token },
    connId,
  }: SendMessageArgs<MessageType.GET_VIDEO_UPDATE>) {
    const locale = this.getLocale({ roomId: id, userId });
    const { errorCode, unitId } = await this.checkTokenCb({ token });
    const isDefault = checkDefaultAuth({ unitId });
    // TODO refactor checks to one auth method
    if (errorCode !== 0 && !isDefault) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.forbidden,
            code: ErrorCode.forbidden,
          },
        },
      });
      return;
    }
    if (!isDefault && userId.toString() !== unitId) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notAuthorised,
            code: ErrorCode.notAuthorised,
          },
        },
      });
      return;
    }
    if (!args.where.id) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.badRequest,
            code: ErrorCode.badRequest,
          },
        },
      });
      return;
    }
    const _video = await this.videoFindFirst({
      where: {
        id: args.where.id,
      },
      include: {
        Room: {
          select: {
            id: true,
            authorId: true,
          },
        },
      },
    });
    if (_video === undefined) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'error',
            message: locale.serverError,
            code: ErrorCode.serverError,
          },
        },
      });
      return;
    }
    if (_video === null) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notFound,
            code: ErrorCode.notFound,
          },
        },
      });
      return;
    }
    if (userId.toString() !== _video.Room.authorId || id.toString() !== _video.Room.id) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notAuthorised,
            code: ErrorCode.notAuthorised,
          },
        },
      });
      return;
    }
    const oldVideoPath = getVideoPath({ cloudPath: this.cloudPath, roomId: id, name: _video.name });
    if (!fs.existsSync(oldVideoPath)) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notFound,
            code: ErrorCode.notFound,
          },
        },
      });
      return;
    }

    const video = await this.videoUpdate({ ...args });
    if (video === undefined) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'error',
            message: locale.serverError,
            code: ErrorCode.serverError,
          },
        },
      });
      return;
    }
    if (video === null) {
      this.sendMessage({
        roomId: id,
        msg: {
          type: MessageType.SET_ERROR,
          connId,
          id: userId,
          data: {
            type: 'warn',
            message: locale.notFound,
            code: ErrorCode.notFound,
          },
        },
      });
      return;
    }

    const videoPath = getVideoPath({ cloudPath: this.cloudPath, roomId: id, name: video.name });
    fs.renameSync(oldVideoPath, videoPath);

    this.sendMessage({
      roomId: id,
      msg: {
        type: MessageType.SET_VIDEO_UPDATE,
        id: userId,
        connId,
        data: {
          video,
        },
      },
    });
  }
}

export default Settings;
