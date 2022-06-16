/* eslint-disable no-case-declarations */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WS from '../../core/ws';
import DB from '../../core/db';
import {
  log,
  getLoginCookie,
  parseQueryString,
  setTokenCookie,
  getTokenCookie,
} from '../../utils/lib';
import { MessageType } from '../../types/interfaces';
import RTC from '../../core/rtc';

// eslint-disable-next-line import/prefer-default-export
export const useHandleMessages = ({
  ws,
  db,
  restart,
  rtc,
}: {
  ws: WS;
  db: DB;
  rtc: RTC;
  restart: boolean;
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const { pathname, search } = location;

  const [id, setId] = useState<number>(getLoginCookie());
  const [auth, setAuth] = useState<boolean>(false);
  const [loggedAs, setLoggedAs] = useState<string>('');
  const [streams, setStreams] = useState<{ userId: number; stream: MediaStream }[]>([]);
  const [roomIsSaved, setRoomIsSaved] = useState<boolean>(false);

  useEffect(() => {
    const roomId = parseInt(pathname.replace('/', ''), 10);
    const roomOpen = Number.isInteger(roomId);
    const qS = parseQueryString(search);
    const qSUserId = qS?.userId;
    const token = qS?.token || getTokenCookie()?.token || '';
    db.setToken(token);
    ws.onOpen = (ev) => {
      ws.sendMessage({
        type: MessageType.GET_USER_ID,
        id: !qSUserId ? id : 0,
        token: !qSUserId ? db.token : 'null',
        data: {},
      });
    };

    ws.onMessage = (ev) => {
      const { data } = ev;
      const rawMessage = ws.parseMessage(data);
      if (!rawMessage) {
        return;
      }
      const { type, id: _id } = rawMessage;
      let res;
      const args = {
        where: {
          id: _id,
        },
        include: {
          User: {
            select: {
              email: true,
            },
          },
        },
      };
      if (type === MessageType.SET_USER_ID) {
        ws.setUserId(_id);
        res = db.guestFindFirst(args);
      }
      switch (type) {
        case MessageType.SET_USER_ID:
          const { id: __id, token: _token } = ws.getMessage(MessageType.SET_USER_ID, rawMessage);
          if (_token && _token !== 'null') {
            setTokenCookie(_token);
            setAuth(true);
            let isAuth = false;
            if (qS?.token) {
              isAuth = true;
              navigate(pathname);
            }
            ws.sendMessage({
              id: ws.userId,
              token,
              isAuth,
              type: MessageType.GET_GUEST_FIND_FIRST,
              data: {
                args,
              },
            });
          } else {
            setAuth(false);
            setLoggedAs('');
          }
          if (roomOpen) {
            ws.setUserId(_id);
            rtc.createRTC({ id: roomId });
            rtc.onAddTrack = (myId, stream) => {
              log('info', 'Added local stream to room', { myId, _id });
              const _streams = streams.map((_item) => _item);
              _streams.push({ userId: myId, stream });
              setStreams(_streams);
            };
            rtc.invite({ targetUserId: roomId, userId: _id });
            ws.sendMessage({
              type: MessageType.GET_ROOM,
              id: roomId,
              token: db.token,
              data: {
                userId: ws.userId,
              },
            });
          }
          setId(__id);
          break;
        case MessageType.SET_GUEST_FIND_FIRST:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r: Awaited<typeof res> = (rawMessage.data as any).argv;
          setLoggedAs(r?.User[0].email || '');
          break;
        case MessageType.SET_AUTH:
          console.log(ws.getMessage(MessageType.SET_AUTH, rawMessage).data.message);
          break;
        case MessageType.OFFER:
          if (rtc) {
            rtc.handleOfferMessage(rawMessage, (e) => {
              console.log(11, e);
            });
          }
          break;
        case MessageType.CANDIDATE:
          if (rtc) {
            rtc.handleCandidateMessage(rawMessage);
          }
          break;
        case MessageType.SET_CHANGE_ROOM_GUESTS:
          const { roomUsers } = ws.getMessage(MessageType.SET_CHANGE_ROOM_GUESTS, rawMessage).data;
          log('info', 'onChangeRoomGuests', { roomUsers });
          roomUsers.forEach((item) => {
            if (item !== ws.userId && rtc) {
              rtc.createRTC({ id: roomId, item });
              rtc.onAddTrack = (addedUserId, stream) => {
                log('info', 'Added stream of new user to room', { addedUserId, item });
                const _streams = streams.map((_item) => _item);
                _streams.push({ userId: addedUserId, stream });
                setStreams(_streams);
              };
              rtc.invite({ targetUserId: roomId, userId: ws.userId, item });
            }
          });
          break;
        case MessageType.ANSWER:
          if (rtc) {
            rtc.handleVideoAnswerMsg(rawMessage, (e) => {
              if (e) {
                log('warn', 'onHandleVideoAnswerMsg', e);
              }
            });
          }
          break;
        case MessageType.SET_ROOM:
          setRoomIsSaved(true);
          break;
        case MessageType.SET_ERROR:
          const {
            data: { message },
          } = ws.getMessage(MessageType.SET_ERROR, rawMessage);
          log('warn', 'error', message);
          break;
        default:
      }
    };
    return () => {
      ws.onOpen = () => {
        /** */
      };
      ws.onMessage = () => {
        /** */
      };
    };
  }, [restart, pathname, roomIsSaved, streams]);
  return { auth, loggedAs, streams, id };
};
