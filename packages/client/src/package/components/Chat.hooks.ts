/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: Chat.hooks.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import React, { useEffect, useState, useMemo, useRef } from 'react';
import WS from '../core/ws';
import { log, getDialogPosition, getRoomId } from '../utils/lib';
import {
  ErrorCode,
  Locale,
  LocaleDefault,
  MessageFull,
  MessageType,
  SendMessageArgs,
} from '../types/interfaces';
import {
  CHAT_TAKE_MESSAGES,
  TEXT_AREA_MAX_ROWS,
  DIALOG_DEFAULT,
  CONTEXT_DEFAULT,
  FIRST_MESSAGE_INDENT,
  FOLOW_QUOTE_STYLE,
  DIALOG_MESSAGE_DIMENSION,
  ALERT_TIMEOUT,
  MOBILE_WIDTH,
  TEXT_AREA_PADDING_LEFT,
  TEXT_AREA_BORDER_WIDTH,
} from '../utils/constants';
import { DialogProps, DialogPropsDefaultContext } from '../types';
import { scrollToBottom, scrollToTop, scrollTo, gettextAreaRows } from './Chat.lib';
import storeError from '../store/error';
import storeClickDocument from '../store/clickDocument';
import { CookieName, getCookie } from '../utils/cookies';
import storeCanConnect, { changeCanConnect } from '../store/canConnect';
import storeRoomIsInactive from '../store/roomIsInactive';
import storeChatBlockeds, { changeChatBlockeds } from '../store/chatBlockeds';
import storeMessage from '../store/message';

let oldSkip = 0;
let scrolled = false;
// eslint-disable-next-line import/prefer-default-export
export const useMesages = ({
  port,
  server,
  roomId,
  userId,
  containerRef,
  inputRef,
  locale,
}: {
  port: number;
  server: string;
  roomId: string | number;
  userId: string | number;
  containerRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  locale: Locale.Client;
}) => {
  const [message, setMessage] = useState<string>('');
  const [chatUnit, setChatUnit] = useState<boolean>(false);
  const [myMessage, setMyMessage] = useState<boolean>(false);
  const [skip, setSkip] = useState<number>(0);
  const [error, setError] = useState<keyof typeof ErrorCode>();
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [count, setCount] = useState<number>(0);
  const [rows, setRows] = useState<number>(1);
  const [editedMessage, setEditedMessage] = useState<string>('');
  const [quotedMessage, setQuotedMessage] = useState<string>('');
  const [blocked, setBlocked] = useState<boolean>(false);
  const [messages, setMessages] = useState<
    SendMessageArgs<MessageType.SET_CHAT_MESSAGES>['data']['result']
  >([]);

  const textAreaLeft = useMemo(
    () => () =>
      document.body.clientWidth > MOBILE_WIDTH ? TEXT_AREA_PADDING_LEFT : TEXT_AREA_BORDER_WIDTH,
    []
  );

  const editMessage = useMemo(
    () => messages.find((item) => item.id === editedMessage),
    [editedMessage, messages]
  );

  const quoteMessage = useMemo(
    () => messages.find((item) => item.id === quotedMessage),
    [quotedMessage, messages]
  );

  const ws = useMemo(() => new WS({ server, port, protocol: 'chat' }), [port, server]);

  const onClickCloseEditMessage = useMemo(
    () => () => {
      setEditedMessage('');
      setQuotedMessage('');
    },
    []
  );

  const clickBlockChatWrapper = useMemo(
    () => (context: DialogProps<DialogPropsDefaultContext>['context']) => () => {
      const { unitId } = context;
      ws.sendMessage({
        id: roomId,
        type: MessageType.GET_BLOCK_CHAT,
        connId: '',
        data: {
          target: unitId,
          command: 'add',
        },
      });
    },
    [roomId, ws]
  );

  const changeText = useMemo(
    () => (e: React.FormEvent<HTMLTextAreaElement>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { target }: any = e;
      const { value } = target;
      const c = gettextAreaRows(value);
      if (c <= TEXT_AREA_MAX_ROWS) {
        setRows(c);
      } else {
        setRows(TEXT_AREA_MAX_ROWS);
      }
      setMessage(value);
    },
    []
  );

  const clickQuoteWrapper = useMemo(
    () => (context: DialogProps<DialogPropsDefaultContext>['context']) => () => {
      const { id, text } = context;
      setQuotedMessage(id);
      setEditedMessage('');
      let _rows = gettextAreaRows(text);
      _rows = _rows <= TEXT_AREA_MAX_ROWS ? _rows : TEXT_AREA_MAX_ROWS;
      setRows(_rows);
      const { current } = inputRef;
      if (current) {
        current.select();
        current.selectionStart = text.length;
      }
    },
    [inputRef]
  );

  const clickEditWrapper = useMemo(
    () => (context: DialogProps<DialogPropsDefaultContext>['context']) => () => {
      const { text, id } = context;
      setEditedMessage(id);
      setQuotedMessage('');
      setMessage(text);
      let _rows = gettextAreaRows(text);
      _rows = _rows <= TEXT_AREA_MAX_ROWS ? _rows : TEXT_AREA_MAX_ROWS;
      setRows(_rows);
      const { current } = inputRef;
      if (current) {
        current.select();
        current.selectionStart = text.length;
      }
    },
    [inputRef]
  );

  const clickDeleteWrapper = useMemo(
    () => (context: DialogProps<DialogPropsDefaultContext>['context']) => () => {
      const { id } = context;
      ws.sendMessage({
        type: MessageType.GET_DELETE_MESSAGE,
        connId: '',
        id: roomId,
        data: {
          args: {
            where: {
              id,
            },
          },
          userId,
        },
      });
    },
    [roomId, userId, ws]
  );

  const sendMessage = useMemo(
    () => () => {
      const mess = message.replace(/[\n\s]+/g, '');
      // if message is not empty
      if (mess) {
        if (editedMessage) {
          ws.sendMessage({
            type: MessageType.GET_EDIT_MESSAGE,
            connId: '',
            id: roomId,
            data: {
              args: {
                where: {
                  id: editedMessage,
                },
                data: {
                  text: message,
                  updated: new Date(),
                },
                include: {
                  Unit: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  Quote: {
                    select: {
                      MessageQuote: {
                        include: {
                          Unit: {
                            select: {
                              id: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              userId,
            },
          });
          setEditedMessage('');
        } else {
          ws.sendMessage({
            type: MessageType.GET_ROOM_MESSAGE,
            connId: '',
            id: roomId,
            data: {
              message,
              userId,
            },
          });
        }
      } else {
        setRows(1);
        setMessage(message);
      }
    },
    [message, userId, roomId, ws, editedMessage]
  );

  /**
   * On change pathname
   */
  useEffect(
    () => () => {
      const _roomId = getRoomId(window.location.pathname);
      if (_roomId !== roomId) {
        ws.connection.close();
      }
    },
    // ? wlp
    [window.location.pathname, roomId, ws.connection]
  );

  /**
   * Listen error
   */
  useEffect(() => {
    const cleanSubs = storeError.subscribe(() => {
      const { error: _error } = storeError.getState();
      switch (_error) {
        case ErrorCode.roomIsInactive:
          setMessages([]);
          break;
        default:
      }
      setError(_error);
    });
    return () => {
      cleanSubs();
    };
  }, []);

  /**
   * Scroll by load
   */
  useEffect(() => {
    const { current } = containerRef;
    if (current && !scrolled) {
      scrollToBottom(current);
    }
  }, [containerRef, messages]);

  /**
   * Scroll by new message
   */
  useEffect(() => {
    const { current } = containerRef;
    if (current) {
      scrollToBottom(current);
    }
  }, [myMessage, containerRef]);

  /**
   * Container scroll handler
   */
  useEffect(() => {
    const { current } = containerRef;
    // TODO attention here
    const timeout = setTimeout(() => {
      scrolled = false;
    }, 1000);
    const containerOnScroll = () => {
      if (scrolled) {
        clearTimeout(timeout);
      }
      scrolled = true;
      if (current) {
        if (current.scrollTop === 0 && count > messages.length) {
          setSkip(skip + CHAT_TAKE_MESSAGES);
          scrollToTop(current);
        }
      }
    };
    if (current) {
      current.addEventListener('scroll', containerOnScroll);
    }
    return () => {
      if (current) {
        current.removeEventListener('scroll', containerOnScroll);
      }
    };
  }, [containerRef, skip, count, messages]);

  /**
   * Get first chat messages
   */
  useEffect(() => {
    const nonScroll = skip - oldSkip !== 1 && oldSkip - skip !== 1;
    if (chatUnit && nonScroll && ErrorCode.initial === error) {
      ws.sendMessage({
        type: MessageType.GET_CHAT_MESSAGES,
        id: roomId,
        connId: '',
        data: {
          userId,
          args: {
            where: {
              roomId: roomId.toString(),
            },
            include: {
              Unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
              Quote: {
                select: {
                  MessageQuote: {
                    include: {
                      Unit: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: {
              created: 'desc',
            },
            take: CHAT_TAKE_MESSAGES,
            skip,
          },
        },
      });
    }
    oldSkip = skip;
  }, [ws, roomId, chatUnit, userId, skip, error]);

  /**
   * Send message from storeMessage
   */
  useEffect(() => {
    const storeMessageHandler = (second = false) => {
      const {
        message: { type, value },
      } = storeMessage.getState();
      if (type === 'chat') {
        if (ws.connection.readyState === ws.connection.OPEN) {
          ws.sendMessage(value);
        } else if (second === false) {
          setTimeout(() => {
            storeMessageHandler(true);
          }, 1000);
        } else {
          log('warn', 'Ws not found on sendMessage', { type, value });
        }
      }
    };
    const cleanSubs = storeMessage.subscribe(storeMessageHandler);
    return () => {
      cleanSubs();
    };
  }, [ws]);

  /**
   * Listen can connect
   */
  useEffect(() => {
    const cleanSubs = storeCanConnect.subscribe(() => {
      const { canConnect: _canConnect } = storeCanConnect.getState();
      if (!_canConnect) {
        ws.connection.close();
      }
    });
    return () => {
      cleanSubs();
    };
  }, [ws.connection]);

  /**
   * Handle messages
   */
  useEffect(() => {
    ws.onOpen = () => {
      setTimeout(() => {
        ws.sendMessage({
          id: roomId,
          type: MessageType.GET_CHAT_UNIT,
          connId: '',
          data: {
            userId,
            locale: getCookie(CookieName.lang) || LocaleDefault,
          },
        });
      }, 250);
    };
    const setChatMessagesHandler = ({
      data: { result, count: _count },
    }: SendMessageArgs<MessageType.SET_CHAT_MESSAGES>) => {
      let _result = [];
      for (let i = result.length - 1; i >= 0; i--) {
        _result.push(result[i]);
      }
      if (messages) {
        _result = _result.concat(messages);
      }
      setCount(_count);
      setMessages(_result);
    };

    const setEditMessageHandler = ({ data }: SendMessageArgs<MessageType.SET_EDIT_MESSAGE>) => {
      const { id } = data;
      const _messages: MessageFull[] = [];
      let check = false;
      for (let i = 0; messages[i]; i++) {
        const _message = messages[i];
        if (_message.id === id) {
          check = true;
          _messages.push(data);
        } else {
          _messages.push(_message);
        }
      }
      if (!check) {
        _messages.push(data);
      }
      setIsEdit(false);
      setMessages(_messages);
      setMessage('');
      setRows(1);
    };

    const setDeleteMessageHandler = ({
      data: { id },
    }: SendMessageArgs<MessageType.SET_DELETE_MESSAGE>) => {
      const _messages = messages.filter((item) => item.id !== id);
      setMessages(_messages);
      setSkip(skip - 1);
    };

    const setChatUnitHandler = () => {
      storeCanConnect.dispatch(
        changeCanConnect({
          canConnect: true,
        })
      );
      setChatUnit(true);
    };

    const setErrorHandler = ({
      data: { message: children, type, code },
    }: SendMessageArgs<MessageType.SET_ERROR>) => {
      log(type, children, {}, true);
      switch (code) {
        case ErrorCode.duplicateTab:
          setTimeout(() => {
            // eslint-disable-next-line no-restricted-globals
            alert(locale.willBeReconnect);
            window.history.go(-1);
          }, ALERT_TIMEOUT);
          break;
        default:
      }
    };

    const setRoomMessage = ({ data }: SendMessageArgs<MessageType.SET_ROOM_MESSAGE>) => {
      if (messages) {
        if (quotedMessage) {
          setQuotedMessage('');
          ws.sendMessage({
            type: MessageType.GET_CREATE_QUOTE,
            connId: '',
            id: roomId,
            data: {
              args: {
                data: {
                  messageId: data.id,
                  quoteId: quotedMessage,
                },
              },
              userId,
            },
          });
        } else {
          const _messages = messages.map((item) => item);
          _messages.push(data);
          setMessages(_messages);
          if (data.unitId === userId.toString()) {
            setMyMessage(!myMessage);
            setMessage('');
            setRows(1);
          }
          setSkip(skip + 1);
        }
      }
    };

    const setCreateQuoteHandler = ({ data }: SendMessageArgs<MessageType.SET_CREATE_QUOTE>) => {
      ws.sendMessage({
        type: MessageType.GET_EDIT_MESSAGE,
        connId: '',
        id: roomId,
        data: {
          args: {
            where: {
              id: data.messageId,
            },
            data: {
              quoteId: data.id,
            },
            include: {
              Unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
              Quote: {
                select: {
                  MessageQuote: {
                    include: {
                      Unit: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          userId,
        },
      });
    };

    const setBlockChatHandler = ({
      data: { blocked: _blocked },
    }: SendMessageArgs<MessageType.SET_BLOCK_CHAT>) => {
      if (_blocked.indexOf(userId) !== -1) {
        if (!blocked) {
          setBlocked(true);
        }
      } else if (blocked) {
        setBlocked(false);
      }
      storeChatBlockeds.dispatch(
        changeChatBlockeds({
          chatBlockeds: _blocked,
        })
      );
    };

    ws.onMessage = (ev) => {
      const { data } = ev;
      const rawMessage = ws.parseMessage(data);
      if (!rawMessage) {
        return;
      }
      const { type } = rawMessage;
      switch (type) {
        case MessageType.SET_ROOM_MESSAGE:
          setRoomMessage(rawMessage);
          break;
        case MessageType.SET_CHAT_MESSAGES:
          setChatMessagesHandler(rawMessage);
          break;
        case MessageType.SET_EDIT_MESSAGE:
          setEditMessageHandler(rawMessage);
          break;
        case MessageType.SET_DELETE_MESSAGE:
          setDeleteMessageHandler(rawMessage);
          break;
        case MessageType.SET_CHAT_UNIT:
          setChatUnitHandler();
          break;
        case MessageType.SET_CREATE_QUOTE:
          setCreateQuoteHandler(rawMessage);
          break;
        case MessageType.SET_BLOCK_CHAT:
          setBlockChatHandler(rawMessage);
          break;
        case MessageType.SET_ERROR:
          setErrorHandler(rawMessage);
          break;
        default:
      }
    };
    ws.onError = (e) => {
      log('error', 'Error chat', { e });
    };
    ws.onClose = () => {
      log('warn', 'Chat connection closed', {});
    };
    return () => {
      ws.onOpen = () => {
        /** */
      };
      ws.onMessage = () => {
        /** */
      };
      ws.onError = () => {
        /** */
      };
      ws.onClose = () => {
        /** */
      };
    };
  }, [
    roomId,
    userId,
    ws,
    messages,
    message,
    myMessage,
    containerRef,
    skip,
    locale,
    quotedMessage,
    blocked,
  ]);
  return {
    changeText,
    blocked,
    sendMessage,
    chatUnit,
    messages,
    message,
    rows,
    clickQuoteWrapper,
    clickEditWrapper,
    clickDeleteWrapper,
    isEdit,
    error,
    editMessage,
    onClickCloseEditMessage,
    quoteMessage,
    textAreaLeft,
    clickBlockChatWrapper,
  };
};

export const useDialog = () => {
  const [dialog, setDialog] =
    useState<Omit<DialogProps<DialogPropsDefaultContext>, 'children'>>(DIALOG_DEFAULT);
  const messageContextWrapper =
    (item: MessageFull, secure: boolean) => (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const { shiftKey } = ev;
      if (!shiftKey) {
        ev.preventDefault();
        const { clientX: _clientX, clientY: _clientY } = ev;
        const { width, height } = DIALOG_MESSAGE_DIMENSION;
        const { clientX, clientY } = getDialogPosition({ _clientX, _clientY, width, height });
        setDialog({
          open: true,
          clientY,
          clientX,
          width,
          height,
          context: item,
          secure,
        });
      }
    };

  /**
   * Listen click document
   */
  useEffect(() => {
    const cleanStore = storeClickDocument.subscribe(() => {
      // TODO check area
      const {
        clickDocument: { clientX, clientY },
      } = storeClickDocument.getState();
      setDialog({
        open: false,
        clientY: dialog.clientY,
        clientX: dialog.clientX,
        width: 0,
        height: 0,
        context: CONTEXT_DEFAULT,
        secure: false,
      });
    });
    return () => {
      cleanStore();
    };
  }, [dialog]);

  return { dialog, messageContextWrapper };
};

let gettingPosition = false;

export const useScrollToQuote = ({
  containerRef,
  messages,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  messages: SendMessageArgs<MessageType.SET_CHAT_MESSAGES>['data']['result'];
}) => {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const hashChangeHandler = async () => {
      const { hash } = window.location;
      const messId = hash.replace('#', '');
      const { current } = containerRef;
      if (current && !Number.isNaN(messId)) {
        let position = 0;
        const getPosition = async () => {
          gettingPosition = true;
          const { children } = current;
          for (let i = 0; children[i]; i++) {
            const child = children[i];
            const { id } = child;
            if (id === messId) {
              const { top } = child.getBoundingClientRect();
              const indent = current.scrollTop + (top - FIRST_MESSAGE_INDENT);
              position = indent < 1 ? top : indent;
              const oldStyle = child.firstElementChild?.getAttribute('style');
              child.firstElementChild?.setAttribute('style', `${oldStyle}${FOLOW_QUOTE_STYLE}`);
              setTimeout(() => {
                child.firstElementChild?.setAttribute('style', oldStyle || '');
                window.location.hash = '';
              }, 3000);
              break;
            }
          }
          if (position !== 0) {
            gettingPosition = false;
            return position;
          }
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve(0);
            }, 10);
          });
          position = await getPosition();
          return position;
        };
        let check = false;
        for (let i = 0; messages[i]; i++) {
          const { id } = messages[i];
          if (id === messId) {
            check = true;
            break;
          }
        }
        if (check) {
          const _position = await getPosition();
          position = 0;
          scrollTo(current, _position);
        } else if (!gettingPosition) {
          scrollTo(current, 0);
        } else {
          log('warn', 'Unecesary scroll quote case', { check, gettingPosition });
        }
      }
    };
    setTimeout(() => {
      hashChangeHandler();
    }, 200);
    const onHashChange = () => {
      hashChangeHandler();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      mounted.current = false;
    };
  }, [containerRef, messages]);

  return {};
};

export const useRoomIsInactive = () => {
  const [roomIsInactive, setRoomIsInactive] = useState<boolean>(false);
  useEffect(() => {
    const cleanSubs = storeRoomIsInactive.subscribe(() => {
      const { roomIsInactive: _roomIsInactive } = storeRoomIsInactive.getState();
      setRoomIsInactive(_roomIsInactive);
    });
    return () => {
      cleanSubs();
    };
  }, []);
  return roomIsInactive;
};
