/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: rtc.ts
 * Author: Sergey Kolmiller
 * Email: <uyem.ru@gmail.com>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 24 2022 14:14:09 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
// eslint-disable-next-line import/no-relative-packages
//import * as werift from '../werift-webrtc/packages/webrtc/lib/webrtc/src/index';
import * as werift from 'werift';
import { createCertificate, CertificateCreationResult } from 'pem';
import {
  RTCInterface,
  MessageType,
  SendMessageArgs,
  RoomUser,
  ErrorCode,
  RoomList,
} from '../types/interfaces';
import { checkSignallingState, getLocale, log } from '../utils/lib';
import {
  STUN_SERVER,
  SENT_RTCP_INTERVAL,
  SSL_RTC_CONNECTION,
  SSL_SIGNATURE_HASH,
  ICE_PORT_MIN,
  ICE_PORT_MAX,
} from '../utils/constants';
import WS from './ws';
import DB from './db';

// eslint-disable-next-line no-unused-vars
export type OnRoomConnect = (args: {
  roomId: string | number;
  userId: string | number;
  roomUsers: RoomUser[];
}) => void;

// eslint-disable-next-line no-unused-vars
export type OnRoomOpen = (args: { roomId: string | number; ownerId: string | number }) => void;

class RTC
  implements
    Omit<RTCInterface, 'peerConnections' | 'createRTC' | 'handleVideoAnswerMsg' | 'addTracks'>
{
  public peerConnectionsServer: RTCInterface['peerConnectionsServer'] = {};

  public readonly delimiter = '_';

  public rooms: Record<string | number, RoomUser[]> = {};

  public ssrcIntervals: Record<string, NodeJS.Timer> = {};

  public muteds: RoomList = {};

  public offVideo: RoomList = {};

  public askeds: RoomList = {};

  public adminMuteds: RoomList = {};

  public banneds: Record<string, RoomUser[]> = {};

  public muteForAll: Record<string, boolean> = {};

  readonly icePortRange: [number, number] | undefined =
    ICE_PORT_MAX && ICE_PORT_MAX ? [ICE_PORT_MIN, ICE_PORT_MAX] : undefined;

  private ws: WS;

  /**
   * @deprecated
   * move db
   */
  private db: DB;

  public streams: Record<string, Record<string, werift.MediaStreamTrack[]>> = {};

  constructor({ ws, db }: { ws: WS; db: DB }) {
    this.ws = ws;
    this.db = db;
    log('info', 'Ice port range env.(ICE_PORT_MAX, ICE_PORT_MAX) is', this.icePortRange, true);
  }

  public getPeerId(
    id: number | string,
    userId: number | string,
    target: number | string,
    connId: string
  ) {
    return `${id}${this.delimiter}${userId}${this.delimiter}${target || 0}${
      this.delimiter
    }${connId}`;
  }

  public closePeerConnectionHandler({
    id,
    data: { target, roomId },
    connId,
  }: SendMessageArgs<MessageType.GET_CLOSE_PEER_CONNECTION>) {
    this.closeVideoCall({ roomId, userId: id, target, connId });
    this.ws.sendMessage({
      type: MessageType.SET_CLOSE_PEER_CONNECTION,
      id,
      data: {
        target,
        roomId,
      },
      connId,
    });
  }

  public createRTCServer: RTCInterface['createRTCServer'] = async (opts) => {
    const { roomId, userId, target, connId, mimeType } = opts;
    const peerId = this.getPeerId(roomId, userId, target, connId);
    if (!this.peerConnectionsServer[roomId]) {
      this.peerConnectionsServer[roomId] = {};
    }
    if (this.peerConnectionsServer[roomId][peerId]) {
      log('info', 'Duplicate peer connection', opts);
      this.closeVideoCall({ roomId, userId, target, connId });
    } else {
      log('log', 'Creating peer connection', opts);
    }
    const ssl: CertificateCreationResult | null = await new Promise((resolve) => {
      createCertificate({ days: 1, selfSigned: true }, (err, _ssl) => {
        if (err) {
          log('error', 'Error create certificate');
          resolve(null);
        }
        resolve(_ssl);
      });
    });
    this.peerConnectionsServer[roomId][peerId] = new werift.RTCPeerConnection({
      codecs: {
        audio: [
          new werift.RTCRtpCodecParameters({
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
          }),
        ],
        video: [
          new werift.RTCRtpCodecParameters({
            mimeType,
            clockRate: 90000,
            rtcpFeedback: [
              { type: 'ccm', parameter: 'fir' },
              { type: 'nack' },
              { type: 'nack', parameter: 'pli' },
              { type: 'goog-remb' },
            ],
          }),
        ],
      },
      bundlePolicy: 'disable',
      iceTransportPolicy: 'all',
      iceServers: [
        {
          urls: STUN_SERVER,
        },
        {
          urls: process.env.TURN_SERVER as string,
          username: process.env.TURN_SERVER_USER,
          credential: process.env.TURN_SERVER_PASSWORD,
        },
      ],
      icePortRange: this.icePortRange,
      dtls: {
        keys: SSL_RTC_CONNECTION
          ? {
              keyPem: ssl.clientKey,
              certPem: ssl.certificate,
              signatureHash: SSL_SIGNATURE_HASH,
            }
          : undefined,
      },
    });
  };

  public getRevPeerId(peerId: string) {
    const peer = peerId.split(this.delimiter);
    return {
      peerId: `${peer[0]}${this.delimiter}${peer[2]}${this.delimiter}${peer[1]}${this.delimiter}${peer[3]}`,
      userId: peer[2],
      target: peer[1],
      connId: peer[3],
      id: peer[0],
    };
  }

  public handleIceCandidate: RTCInterface['handleIceCandidate'] = ({
    roomId,
    userId,
    target,
    connId,
  }) => {
    const peerId = this.getPeerId(roomId, userId, target, connId);
    if (!this.peerConnectionsServer[roomId]?.[peerId]) {
      log('warn', 'Handle ice candidate without peerConnection', { peerId });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const core = this;
    const { ws, delimiter, rooms } = this;
    const { addTracksServer, peerConnectionsServer } = this;
    this.peerConnectionsServer[roomId][peerId]!.onsignalingstatechange =
      function handleSignalingStateChangeEvent() {
        if (!core.peerConnectionsServer[roomId][peerId]) {
          log('warn', 'On signalling state change without peer connection', { peerId });
          return;
        }
        const state = peerConnectionsServer[roomId][peerId].signalingState;
        log('log', 'On connection state change', { peerId, state, target });
        // Add tracks from remote offer
        if (state === 'have-remote-offer' && target.toString() !== '0') {
          addTracksServer({ roomId, userId, target, connId }, () => {
            //
          });
        }
        log(
          'info',
          '! WebRTC signaling state changed to:',
          core.peerConnectionsServer[roomId][peerId]!.signalingState
        );
        switch (core.peerConnectionsServer[roomId][peerId]!.signalingState) {
          case 'closed':
            core.onClosedCall({ roomId, userId, target, connId, command: 'signalingState' });
            break;
          default:
        }
      };
    this.peerConnectionsServer[roomId][peerId]!.onRemoteTransceiverAdded.subscribe(
      async (transceiver) => {
        if (target.toString() === '0') {
          const [track] = await transceiver.onTrack.asPromise();
          this.ssrcIntervals[peerId] = setInterval(() => {
            transceiver.receiver.sendRtcpPLI(track.ssrc);
          }, SENT_RTCP_INTERVAL);
        }
      }
    );
    const isChanged = false;
    this.peerConnectionsServer[roomId][peerId]!.ontrack = (e) => {
      const peer = peerId.split(delimiter);
      const isRoom = peer[2] === '0';
      const stream = e.streams[0];
      if (!this.streams[roomId]) {
        this.streams[roomId] = {};
      }
      const isNew = !this.streams[roomId][peerId]?.length;
      log('info', 'ontrack', {
        peerId,
        isRoom,
        si: stream.id,
        isNew,
        userId,
        target,
        tracks: stream.getTracks().map((item) => item.kind),
      });
      if (isRoom) {
        if (!this.streams[roomId][peerId]) {
          this.streams[roomId][peerId] = [];
        }
        this.streams[roomId][peerId].push(stream.getTracks()[0]);
        const room = rooms[roomId];
        if (room && isNew && !isChanged) {
          setTimeout(() => {
            room.forEach((item) => {
              ws.sendMessage({
                type: MessageType.SET_CHANGE_UNIT,
                id: item.id,
                data: {
                  target: userId,
                  name: item.name,
                  eventName: 'add',
                  roomLength: rooms[roomId]?.length || 0,
                  muteds: this.muteds[roomId],
                  asked: this.askeds[roomId],
                  adminMuteds: this.adminMuteds[roomId],
                  isOwner: this.rooms[roomId]?.find((_item) => _item.id === userId)?.isOwner,
                  banneds: this.banneds[roomId],
                },
                connId,
              });
            });
          }, 0);
        } else if (!room) {
          log('warn', 'Room missing in memory', { roomId });
        }
      }
    };
  };

  public getVideoTrackHandler = ({
    id,
    data: { command, target, userId },
  }: SendMessageArgs<MessageType.GET_VIDEO_TRACK>) => {
    let index = -1;
    switch (command) {
      case 'add':
        if (this.offVideo[id].indexOf(target) === -1) {
          this.offVideo[id].push(target);
        } else {
          log('warn', 'Duplicate off video', { id, target });
        }
        break;
      case 'delete':
        index = this.offVideo[id].indexOf(target);
        if (index !== -1) {
          this.offVideo[id].splice(index, 1);
        } else {
          log('warn', 'Deleted offVideo is missting', { id, target });
        }
        break;
      default:
    }
    this.rooms[id].forEach((item) => {
      this.ws.sendMessage({
        type: MessageType.SET_VIDEO_TRACK,
        id: item.id,
        connId: '',
        data: {
          offVideo: this.offVideo[id],
          command,
          target,
          userId,
        },
      });
    });
  };

  public handleCandidateMessage: RTCInterface['handleCandidateMessage'] = async (msg, cb) => {
    const {
      id,
      connId,
      data: { candidate, userId, target, roomId },
    } = msg;
    const peerId = this.getPeerId(id, userId, target, connId);
    const cand = new werift.RTCIceCandidate(candidate as werift.RTCIceCandidate);
    log('log', 'Trying to add ice candidate:', {
      peerId,
      connId,
      id,
      userId,
      target,
    });
    if (!this.peerConnectionsServer[roomId]?.[peerId]) {
      log('info', 'Skiping add ice candidate', {
        connId,
        id,
        userId,
        peerId,
        target,
        state: this.peerConnectionsServer[roomId][peerId]?.connectionState,
        ice: this.peerConnectionsServer[roomId][peerId]?.iceConnectionState,
        ss: this.peerConnectionsServer[roomId][peerId]?.signalingState,
      });
      return;
    }
    this.peerConnectionsServer[roomId][peerId]!.addIceCandidate(cand)
      .then(() => {
        log('log', '!! Adding received ICE candidate:', { userId, id, target });
        if (cb) {
          cb(cand as RTCIceCandidate);
        }
      })
      .catch((e) => {
        log('error', 'Set ice candidate error', {
          error: e,
          connId,
          id,
          userId,
          target,
          state: this.peerConnectionsServer[roomId][peerId]?.connectionState,
          ice: this.peerConnectionsServer[roomId][peerId]?.iceConnectionState,
          ss: this.peerConnectionsServer[roomId][peerId]?.signalingState,
        });
        if (cb) {
          cb(null);
        }
      });
  };

  public handleOfferMessage: RTCInterface['handleOfferMessage'] = async (msg) => {
    const {
      id,
      connId,
      data: { sdp, userId, target, mimeType, roomId },
    } = msg;
    if (!sdp) {
      log('warn', 'Message offer error because sdp is:', sdp);
      return;
    }
    const peerId = this.getPeerId(id, userId, target, connId);
    await this.createRTCServer({
      roomId: id,
      userId,
      target,
      connId,
      mimeType,
    });
    const opts = {
      roomId: id,
      userId,
      target,
      connId,
      is: this.peerConnectionsServer[roomId][peerId]?.iceConnectionState,
      cs: this.peerConnectionsServer[roomId][peerId]?.connectionState,
      ss: this.peerConnectionsServer[roomId][peerId]?.signalingState,
    };
    log('info', '--> Creating answer', opts);
    if (!this.peerConnectionsServer[roomId]?.[peerId]) {
      log('warn', 'Handle offer message without peer connection', opts);
      return;
    }
    this.handleIceCandidate({
      roomId: id,
      userId,
      target,
      connId,
    });
    const desc = new werift.RTCSessionDescription(sdp.sdp as string, 'offer');
    let error = false;
    if (this.peerConnectionsServer[roomId][peerId]!.getSenders().length !== 0) {
      log('warn', 'Skipping set remote desc for answer, tracks exists', {});
      error = true;
      return;
    }
    let sendersLength = 0;
    await this.peerConnectionsServer[roomId][peerId]!.setRemoteDescription(desc).catch((e) => {
      sendersLength = this.peerConnectionsServer[roomId][peerId]!.getSenders().length;
      if (sendersLength === 0) {
        log('error', 'Error set remote description', { e: e.message, stack: e.stack, ...opts });
      } else {
        log('warn', 'Senders length is not zero:', sendersLength);
      }
      error = true;
    });
    if (!this.peerConnectionsServer[roomId]?.[peerId]) {
      log('warn', 'Create answer without peer connection', opts);
      return;
    }
    const { signalingState } = this.peerConnectionsServer[roomId][peerId];
    if (!checkSignallingState(signalingState)) {
      log('info', 'Skiping create answer', { signalingState, peerId, roomId });
      return;
    }
    const answ = await this.peerConnectionsServer[roomId][peerId]!.createAnswer().catch((e) => {
      log('error', 'Error create answer', {
        e: e.message,
        stack: e.stack,
        ...opts,
      });
      error = true;
    });
    if (!answ) {
      log('warn', 'Answer is', answ);
      error = true;
      return;
    }
    log('info', '---> Setting local description after creating answer', { ...opts });
    if (!this.peerConnectionsServer[roomId]?.[peerId] || error) {
      log('warn', 'Skipping set local description for answer', {
        error,
        ...opts,
        sendersLength,
      });
      return;
    }
    await this.peerConnectionsServer[roomId][peerId]!.setLocalDescription(answ).catch((err) => {
      log('error', 'Error set local description for answer 2', {
        message: err.message,
        stack: err.stack,
        ...opts,
      });
      error = true;
    });
    const { localDescription } = this.peerConnectionsServer[roomId][peerId]!;
    if (localDescription) {
      log('info', 'Sending answer packet back to other peer', opts);
      this.ws.sendMessage({
        id: userId,
        type: MessageType.ANSWER,
        data: {
          sdp: localDescription,
          userId: id,
          target,
        },
        connId,
      });
    } else {
      log('warn', 'Failed send answer because localDescription is', localDescription);
    }
  };

  private getStreamConnId(roomId: string | number, userId: string | number) {
    let _connId = '';
    const keys = this.getKeysStreams(roomId);
    keys.every((element) => {
      const str = element.split(this.delimiter);
      const isTarget = str[1] === userId.toString() && str[2] === '0';
      if (isTarget) {
        // eslint-disable-next-line prefer-destructuring
        _connId = str[3];
        return false;
      }
      return true;
    });
    return _connId;
  }

  private getPeerConnId(roomId: string | number, userId: string | number, target: number | string) {
    let _connId = '';
    const keys = this.getPeerConnectionKeys(roomId);
    keys.every((element) => {
      const str = element.split(this.delimiter);
      const isTarget = str[1] === userId.toString() && str[2] === target.toString();
      if (isTarget) {
        // eslint-disable-next-line prefer-destructuring
        _connId = str[3];
        return false;
      }
      return true;
    });
    return _connId;
  }

  public getKeysStreams(roomId: string | number) {
    return Object.keys(this.streams[roomId]);
  }

  public addTracksServer: RTCInterface['addTracksServer'] = ({
    roomId,
    connId,
    userId,
    target,
  }) => {
    const _connId = this.getStreamConnId(roomId, target);
    const _connId1 = this.getPeerConnId(roomId, userId, target);
    const peerId = this.getPeerId(roomId, userId, target, _connId1);
    const _peerId = this.getPeerId(roomId, target, 0, _connId);
    const tracks = this.streams[roomId][_peerId];
    const streams = this.getKeysStreams(roomId);
    const opts = {
      roomId,
      userId,
      target,
      connId,
      _peerId,
      peerId,
      tracksL: tracks?.length,
      tracks: tracks?.map((item) => item.kind),
      ssL: streams.length,
      cS: this.peerConnectionsServer[roomId][peerId]?.connectionState,
      sS: this.peerConnectionsServer[roomId][peerId]?.signalingState,
      iS: this.peerConnectionsServer[roomId][peerId]?.iceConnectionState,
    };
    if (!tracks || tracks?.length === 0) {
      log('info', 'Skiping add track', { ...opts, tracks });
      return;
    }
    if (this.peerConnectionsServer[roomId][peerId]) {
      log('info', 'Add tracks', opts);
      tracks.forEach((track) => {
        this.peerConnectionsServer[roomId][peerId]!.addTrack(track);
      });
    } else {
      log('error', 'Can not add tracks', { opts });
    }
  };

  private cleanStream({
    roomId,
    peerId,
    target,
  }: {
    roomId: string | number;
    peerId: string;
    target: string | number;
  }) {
    if (this.streams[roomId]?.[peerId]) {
      delete this.streams[roomId][peerId];
    } else if (target.toString() === '0') {
      log('warn', 'Delete undefined stream', { peerId });
    }
  }

  public closeVideoCall: RTCInterface['closeVideoCall'] = ({ roomId, userId, target, connId }) => {
    const peerId = this.getPeerId(roomId, userId, target, connId);
    this.cleanStream({ roomId, peerId, target });
    if (!this.peerConnectionsServer[roomId]?.[peerId]) {
      log('warn', 'Close video call without peer connection', { peerId });
      return;
    }
    log('info', '| Closing the call', {
      peerId,
    });
    this.peerConnectionsServer[roomId][peerId]!.onsignalingstatechange = null;
    this.peerConnectionsServer[roomId][peerId]!.onnegotiationneeded = null;
    this.peerConnectionsServer[roomId][peerId]!.ontrack = null;
    this.peerConnectionsServer[roomId][peerId]!.close();
    delete this.peerConnectionsServer[roomId][peerId];
    if (target.toString() === '0') {
      clearInterval(this.ssrcIntervals[peerId]);
    }
  };

  // TODO check errors
  public async addUserToRoom({
    userId,
    roomId,
    onRoomOpen,
    isPublic,
  }: {
    userId: number | string;
    roomId: number | string;
    onRoomOpen?: OnRoomOpen;
    isPublic: boolean;
  }): Promise<{ error: 1 | 0; isOwner: boolean }> {
    let room = await this.db.roomFindFirst({
      where: {
        id: roomId.toString(),
      },
    });
    const locale = getLocale(this.ws.users[userId].locale).server;
    let isOwner = room?.authorId === userId.toString();
    if (!room) {
      const authorId = userId.toString();
      room = await this.db.roomCreate({
        data: {
          id: roomId.toString(),
          authorId: isPublic ? undefined : authorId,
          Guests: {
            create: {
              unitId: authorId,
            },
          },
        },
      });
      isOwner = room?.authorId !== null;
      this.ws.sendMessage({
        type: MessageType.SET_ERROR,
        id: userId,
        connId: '',
        data: {
          message: locale.connected,
          type: 'log',
          code: ErrorCode.initial,
        },
      });
    } else {
      if (room.archive) {
        if (!isOwner && room?.authorId !== null) {
          this.ws.sendMessage({
            type: MessageType.SET_ERROR,
            id: userId,
            connId: '',
            data: {
              message: locale.roomInactive,
              type: 'warn',
              code: ErrorCode.roomIsInactive,
            },
          });
          return {
            error: 1,
            isOwner,
          };
        }
        if (isOwner && room?.authorId !== null) {
          isOwner = true;
          await this.db.roomUpdate({
            where: {
              id: room.id,
            },
            data: {
              archive: false,
              updated: new Date(),
            },
          });
        }
      }
      this.ws.sendMessage({
        type: MessageType.SET_ERROR,
        id: userId,
        connId: '',
        data: {
          message: locale.connected,
          type: 'log',
          code: ErrorCode.initial,
        },
      });
      this.db
        .unitFindFirst({
          where: {
            id: userId.toString(),
          },
          select: {
            IGuest: {
              select: {
                id: true,
              },
            },
          },
        })
        .then((g) => {
          const id = roomId.toString();
          if (!g) {
            log('warn', 'Unit not found', { id: userId.toString() });
          } else if (!g?.IGuest[0]) {
            this.db
              .unitUpdate({
                where: {
                  id: userId.toString(),
                },
                data: {
                  IGuest: {
                    create: {
                      roomId: id,
                    },
                  },
                  updated: new Date(),
                },
              })
              .then((r) => {
                if (!r) {
                  log('warn', 'Room not updated', { roomId });
                }
              });
          } else if (g.IGuest[0].id) {
            this.db.unitUpdate({
              where: {
                id: userId.toString(),
              },
              data: {
                IGuest: {
                  update: {
                    where: {
                      id: g.IGuest[0].id,
                    },
                    data: {
                      updated: new Date(),
                    },
                  },
                },
              },
            });
          } else {
            log('warn', 'Room not saved', { g: g.IGuest[0]?.id, id });
          }
        });
    }
    const { name } = this.ws.users[userId];
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = [
        {
          id: userId,
          name,
          isOwner,
        },
      ];
      this.muteds[roomId] = [];
      this.adminMuteds[roomId] = [];
      this.banneds[roomId] = [];
      this.offVideo[roomId] = [];
    } else if (!this.rooms[roomId].find((item) => userId === item.id)) {
      this.rooms[roomId].push({
        id: userId,
        name,
        isOwner,
      });
    } else {
      log('info', 'Room exists and user added before.', { roomId, userId });
    }
    if (isOwner && onRoomOpen) {
      onRoomOpen({ roomId, ownerId: userId });
    }
    return { error: 0, isOwner };
  }

  public getRoomLenght() {
    return Object.keys(this.rooms).length;
  }

  public async handleGetRoomMessage({
    message,
    port,
    cors,
    onRoomConnect,
    onRoomOpen,
  }: {
    message: SendMessageArgs<MessageType.GET_ROOM>;
    port: number;
    cors: string;
    onRoomConnect?: OnRoomConnect;
    onRoomOpen?: OnRoomOpen;
  }) {
    log('log', 'Get room message', message);
    const {
      data: { userId: uid, mimeType },
      id,
      connId,
    } = message;
    if (!this.rooms[id]) {
      this.rooms[id] = [];
      this.askeds[id] = [];
      this.muteds[id] = [];
      this.adminMuteds[id] = [];
      this.banneds[id] = [];
      this.offVideo[id] = [];
    }
    let index = -1;
    this.banneds[id].every((item, i) => {
      if (item.id === uid) {
        index = i;
        return false;
      }
      return true;
    });
    const locale = getLocale(this.ws.users[uid].locale).server;
    if (index !== -1) {
      this.ws.sendMessage({
        type: MessageType.SET_ERROR,
        id: uid,
        connId,
        data: {
          type: 'warn',
          code: ErrorCode.youAreBanned,
          message: locale.youAreBanned,
        },
      });
      return;
    }
    const { error, isOwner } = await this.addUserToRoom({
      roomId: id,
      userId: uid,
      onRoomOpen,
      isPublic: message.data.isPublic,
    });
    if (error) {
      this.ws.sendMessage({
        type: MessageType.SET_ROOM,
        id: uid,
        data: {
          isOwner,
          asked: this.askeds[id],
        },
        connId,
      });
      log('warn', 'Can not add user to room', { id, uid });
      return;
    }
    const connection = new this.ws.WebSocket(`ws://localhost:${port}`, {
      headers: {
        origin: cors.split(',')[0],
      },
    });
    connection.onopen = () => {
      log('info', 'On open room', { roomId: id, userId: uid, target: 0, connId, mimeType });
      connection.send(
        JSON.stringify({
          type: MessageType.GET_USER_ID,
          id,
          data: {
            isRoom: true,
          },
          connId: '',
        })
      );
      connection.onmessage = (mess) => {
        const msg = this.ws.parseMessage(mess.data as string);
        if (msg) {
          const { type } = msg;
          switch (type) {
            case MessageType.OFFER:
              this.handleOfferMessage(msg);
              break;
            case MessageType.CANDIDATE:
              this.handleCandidateMessage(msg);
              break;
            default:
          }
        }
      };
    };
    if (onRoomConnect) {
      onRoomConnect({
        roomId: id,
        userId: uid,
        roomUsers: this.rooms[id],
      });
    }
    if (this.muteds[id].indexOf(uid) === -1) {
      this.muteds[id].push(uid);
    }
    if (this.offVideo[id].indexOf(uid) === -1) {
      this.offVideo[id].push(uid);
    }
    if (this.muteForAll[id] === undefined) {
      this.muteForAll[id] = false;
    }
    if (
      this.adminMuteds[id].indexOf(uid) === -1 &&
      !this.rooms[id].find((item) => item.id === uid).isOwner &&
      this.muteForAll[id]
    ) {
      this.adminMuteds[id].push(uid);
    }
    this.ws.sendMessage({
      type: MessageType.SET_ROOM,
      id: uid,
      data: {
        isOwner,
        asked: this.askeds[id],
      },
      connId,
    });
    this.rooms[id].forEach((item) => {
      this.ws.sendMessage({
        type: MessageType.SET_VIDEO_TRACK,
        id: item.id,
        data: {
          offVideo: this.offVideo[id],
          command: 'add',
          target: item.id,
          userId: item.id,
        },
        connId,
      });
    });
    this.ws.sendMessage({
      type: MessageType.SET_MUTE_LIST,
      id: uid,
      data: {
        muteds: this.muteds[id],
        adminMuteds: this.adminMuteds[id],
        askeds: this.askeds[id],
      },
      connId,
    });
    if (isOwner) {
      this.ws.sendMessage({
        type: MessageType.SET_BAN_LIST,
        id: uid,
        data: {
          banneds: this.banneds[id],
        },
        connId,
      });
      this.ws.sendMessage({
        type: MessageType.SET_MUTE_FOR_ALL,
        id: uid,
        data: {
          value: this.muteForAll[id],
        },
        connId,
      });
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public onClosedCall: RTCInterface['onClosedCall'] = (args) => {
    log('warn', 'Call is closed', { ...args });
  };

  public getPeerConnectionKeys(roomId: string | number) {
    return Object.keys(this.peerConnectionsServer[roomId] || {});
  }

  public cleanConnections(roomId: string, userId: string) {
    const peerKeys = this.getPeerConnectionKeys(roomId);
    peerKeys.forEach((__item) => {
      const peer = __item.split(this.delimiter);
      if (peer[1] === userId.toString()) {
        this.closeVideoCall({
          roomId,
          userId,
          target: peer[2],
          connId: peer[3],
        });
      } else if (peer[2] === userId.toString()) {
        this.closeVideoCall({
          roomId,
          userId: peer[1],
          target: userId,
          connId: peer[3],
        });
      }
    });
  }

  public getMuteHandler({ id, data: { muted, roomId } }: SendMessageArgs<MessageType.GET_MUTE>) {
    const index = this.muteds[roomId].indexOf(id);
    if (muted) {
      if (index === -1) {
        this.muteds[roomId].push(id);
      }
    } else {
      this.muteds[roomId].splice(index, 1);
    }
    this.rooms[roomId].forEach((item) => {
      this.ws.sendMessage({
        type: MessageType.SET_MUTE,
        id: item.id,
        connId: '',
        data: {
          muteds: this.muteds[roomId],
          adminMuteds: this.adminMuteds[roomId],
        },
      });
      this.ws.sendMessage({
        type: MessageType.SET_MUTE_LIST,
        id: item.id,
        data: {
          muteds: this.muteds[roomId],
          adminMuteds: this.adminMuteds[roomId],
          askeds: this.askeds[roomId],
        },
        connId: '',
      });
    });
  }

  public getMuteForAllHandler = ({
    id,
    data: { value },
  }: SendMessageArgs<MessageType.GET_MUTE_FOR_ALL>) => {
    this.muteForAll[id] = value;
    this.rooms[id].forEach((item) => {
      if (item.isOwner) {
        this.ws.sendMessage({
          type: MessageType.SET_MUTE_FOR_ALL,
          connId: '',
          id: item.id,
          data: {
            value,
          },
        });
      }
    });
  };

  public setAskedFloorHandler = ({
    id,
    data: { userId, command },
  }: SendMessageArgs<MessageType.GET_ASK_FLOOR>) => {
    let index = -1;
    switch (command) {
      case 'add':
        if (this.askeds[id].indexOf(userId) === -1) {
          this.askeds[id].push(userId);
        } else {
          log('warn', 'Duplicate asked user', { id, userId });
        }
        break;
      case 'delete':
        index = this.askeds[id].indexOf(userId);
        if (index !== -1) {
          this.askeds[id].splice(index, 1);
        } else {
          log('warn', 'Remove missing askeds for the floor', { id, userId });
        }
        break;
      default:
    }
    this.rooms[id].forEach((item) => {
      this.ws.sendMessage({
        type: MessageType.SET_ASK_FLOOR,
        id: item.id,
        connId: '',
        data: {
          userId,
          roomId: id,
          asked: this.askeds[id],
        },
      });
    });
  };

  public getToMuteHandler({
    id: roomId,
    data: { target },
  }: SendMessageArgs<MessageType.GET_TO_MUTE>) {
    if (!this.adminMuteds[roomId]) {
      this.adminMuteds[roomId] = [];
    }
    if (this.adminMuteds[roomId].indexOf(target) === -1) {
      this.adminMuteds[roomId].push(target);
    } else {
      log('warn', 'Duplicate to mute command', { roomId, target });
    }
    this.rooms[roomId].forEach((item) => {
      this.ws.sendMessage({
        type: MessageType.SET_MUTE,
        id: item.id,
        connId: '',
        data: {
          muteds: this.muteds[roomId],
          adminMuteds: this.adminMuteds[roomId],
        },
      });
      this.ws.sendMessage({
        type: MessageType.SET_MUTE_LIST,
        id: item.id,
        data: {
          muteds: this.muteds[roomId],
          adminMuteds: this.adminMuteds[roomId],
          askeds: this.askeds[roomId],
        },
        connId: '',
      });
    });
  }

  public handleGetToBan({
    id: roomId,
    data: { target, userId },
  }: SendMessageArgs<MessageType.GET_TO_BAN>) {
    if (!this.banneds[roomId]) {
      this.banneds[roomId] = [];
    }
    let index = -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.banneds[roomId].every((item, i) => {
      if (item.id === target) {
        index = i;
        return false;
      }
      return true;
    });
    if (index === -1) {
      const user = this.rooms[roomId].find((item) => item.id === target);
      if (user) {
        this.banneds[roomId].push(user);
      } else {
        log('warn', 'Banned user not found in room', { userId, target });
      }
    } else {
      log('warn', 'Duplicate to ban command', { roomId, target });
    }
    const locale = getLocale(this.ws.users[target].locale).server;
    const connId = this.ws.users[target]?.connId;
    this.ws.sendMessage({
      type: MessageType.SET_BAN_LIST,
      id: userId,
      data: {
        banneds: this.banneds[roomId],
      },
      connId: '',
    });
    this.ws.sendMessage(
      {
        type: MessageType.SET_ERROR,
        id: target,
        connId,
        data: {
          type: 'warn',
          code: ErrorCode.youAreBanned,
          message: locale.youAreBanned,
        },
      },
      false,
      () => {
        const socketId = this.ws.getSocketId(target, connId);
        if (connId && socketId) {
          this.ws.sockets[socketId].close();
        } else {
          log('warn', 'Banned for not connected', { target, connId, socketId });
        }
      }
    );
  }

  public handleGetToUnMute({
    id: roomId,
    data: { target },
  }: SendMessageArgs<MessageType.GET_TO_UNMUTE>) {
    if (!this.adminMuteds[roomId]) {
      this.adminMuteds[roomId] = [];
    }
    const index = this.adminMuteds[roomId].indexOf(target);
    if (index !== -1) {
      this.adminMuteds[roomId].splice(index, 1);
    } else {
      log('warn', 'Unmute of not muted', { roomId, target });
    }
    this.rooms[roomId].forEach((item) => {
      this.ws.sendMessage({
        type: MessageType.SET_MUTE,
        id: item.id,
        connId: '',
        data: {
          muteds: this.muteds[roomId],
          adminMuteds: this.adminMuteds[roomId],
        },
      });
      this.ws.sendMessage({
        type: MessageType.SET_MUTE_LIST,
        id: item.id,
        data: {
          muteds: this.muteds[roomId],
          adminMuteds: this.adminMuteds[roomId],
          askeds: this.askeds[roomId],
        },
        connId: '',
      });
    });
  }

  public handleGetToUnBan({
    id: roomId,
    data: { target, userId },
  }: SendMessageArgs<MessageType.GET_TO_UNBAN>) {
    if (!this.banneds[roomId]) {
      this.banneds[roomId] = [];
    }
    let index = -1;
    this.banneds[roomId].every((it, i) => {
      if (it.id === target) {
        index = i;
        return false;
      }
      return true;
    });
    if (index !== -1) {
      this.banneds[roomId].splice(index, 1);
    } else {
      log('warn', 'Unban of not banned', { roomId, target });
    }
    this.ws.sendMessage({
      type: MessageType.SET_BAN_LIST,
      id: userId,
      data: {
        banneds: this.banneds[roomId],
      },
      connId: '',
    });
  }
}

export default RTC;
