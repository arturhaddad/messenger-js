import './style.css';
import ArenaChat from '@arena-im/chat-sdk';
import React, {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { LiveChat } from '@arena-im/chat-sdk/dist/live-chat/live-chat';
import { ChatMessage } from '@arena-im/chat-types/dist/chat-message';
import { MessageReaction } from '@arena-im/chat-types';
import avatarImg from '../../assets/user-avatar.png';
import msgPanelImg from '../../assets/new-message-bar.png';
import tiltIcon from '../../assets/icons/tilt.png';

const Chat = () => {
  const chatRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<null | HTMLTextAreaElement>(null);
  const [chat, setChat] = useState<LiveChat>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSendMessage, setLoadingSendMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [userName, setUserName] = useState('');
  const arenaChat = new ArenaChat('intibia');

  const fetchChat = async () => {
    setLoading(true);
    const liveChat = await arenaChat.getLiveChat('intibia-global');
    setChat(liveChat);
  };

  const scrollMessagesToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    const recentMessages = await chat?.getMainChannel().loadRecentMessages(20);
    if (recentMessages) {
      setMessages(recentMessages);
      setTimeout(() => {
        scrollMessagesToBottom();
      }, 300);
    }
    setLoading(false);
  };

  const handleChangeNewMessage = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
  };

  const mainChannel = chat?.getMainChannel();

  const mapMessageToState = (id: string): ChatMessage => {
    const currentTime = new Date();
    return {
      createdAt: currentTime.getTime(),
      key: id,
      message: {
        text: newMessage,
      },
      sender: {
        displayName: userName,
      },
    };
  };

  const handleUpdateUserName = async () => {
    await arenaChat.setUser({
      id: `${userName}-arena`,
      name: userName,
      image: '',
    });
  };

  const handleSendMessage = async () => {
    if (mainChannel) {
      setLoadingSendMessage(true);
      const newMessageId = await mainChannel.sendMessage({
        text: newMessage,
      });
      const newMessages = messages.concat(mapMessageToState(newMessageId));
      setMessages(newMessages);
      setNewMessage('');
      scrollMessagesToBottom();
      setLoadingSendMessage(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  };

  const handleSubmitKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLikeMsg = async (id: string) => {
    if (mainChannel) {
      const reactionType = 'love';

      const reaction: MessageReaction = {
        type: reactionType,
        messageID: id,
      };

      mainChannel.sendReaction(reaction);
      const newMessages = messages.map((m) => {
        if (m.key === id) {
          return {
            ...m,
            currentUserReactions: { love: true },
          };
        }
        return m;
      });
      setMessages(newMessages);
    }
  };

  const handleDislikeMsg = async (id: string) => {
    if (mainChannel) {
      const reactionType = 'love';

      const reaction: MessageReaction = {
        type: reactionType,
        messageID: id,
      };

      mainChannel.deleteReaction(reaction);
      const newMessages = messages.map((m) => {
        if (m.key === id) {
          return {
            ...m,
            currentUserReactions: { love: false },
          };
        }
        return m;
      });
      setMessages(newMessages);
    }
  };

  const userLikedMessage = (id: string) => {
    const targetMsg = messages.find((m) => m.key === id);
    // FIXME: The following object property is return undefined
    // even when it exists
    const isLiked = targetMsg?.currentUserReactions?.love;
    if (isLiked) {
      return true;
    }

    return false;
  };

  const handleToggleLikeMsg = (id: string) => {
    if (userLikedMessage(id)) {
      handleDislikeMsg(id);
    } else {
      handleLikeMsg(id);
    }
  };

  const stringToColor = (string: string) => {
    const stringUniqueHash = [...string].reduce(
      (acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), // eslint-disable-line no-bitwise
      0
    );
    return `hsl(${stringUniqueHash % 360}, 95%, 35%)`;
  };

  let lastMsgDate = null;
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const date = new Date(lastMessage.createdAt);
    lastMsgDate = date.toLocaleString();
  }

  const isButtonDisabled =
    loading || loadingSendMessage || newMessage.length === 0;

  useEffect(() => {
    fetchChat();
    const chosenUsername = prompt('Welcome! Please, enter your username:'); // eslint-disable-line no-alert
    setUserName(chosenUsername || 'Unamed-user-2139');
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (userName.length > 0) {
      handleUpdateUserName();
    }
  }, [userName]);

  useEffect(() => {
    if (chat) {
      fetchMessages();
    }
  }, [chat]);

  return (
    <div className="wrapper">
      <div className="container">
        <nav className="navbar" />
        <main>
          <section className="channel-container">
            <header>
              To: {mainChannel && <strong>{mainChannel.channel.name}</strong>}
            </header>
            {loading ? (
              <div className="loading-container">
                <div className="loader">
                  <span />
                </div>
              </div>
            ) : (
              <div className="messages-container" ref={chatRef}>
                {messages.map((m) => (
                  <div className="msg-wrapper" key={m.key}>
                    {/* Verify 'message' attr existence, because it's not present in POLL type */}
                    {m.message && (
                      <div className="msg">
                        <div>
                          <p className="msg-author">
                            {m.sender.displayName} says:
                          </p>
                          <div className="msg-content">
                            <p
                              style={{
                                color: stringToColor(
                                  m.sender.displayName || ''
                                ),
                              }}
                            >
                              {m.message.text}
                            </p>
                            {m.message.media && (
                              <img src={m.message.media.url} alt="" />
                            )}
                          </div>
                        </div>
                        <div className="msg-reaction">
                          <button
                            className={`reaction-button is-liked-${userLikedMessage(
                              m.key
                            )}`}
                            type="button"
                            onClick={() => handleToggleLikeMsg(m.key)}
                          >
                            ♥
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="user-container">
            <div className="new-message">
              <header>
                <img src={msgPanelImg} alt="" />
                <button type="button" className="tilt-button">
                  <img src={tiltIcon} alt="" />
                </button>
              </header>
              <div className="input-container">
                <textarea
                  value={newMessage}
                  onChange={handleChangeNewMessage}
                  onKeyDown={handleSubmitKeyDown}
                  ref={inputRef}
                  disabled={loadingSendMessage}
                  style={{ color: stringToColor(userName) }}
                />
                <button
                  type="button"
                  disabled={isButtonDisabled}
                  onClick={handleSendMessage}
                >
                  Send
                </button>
              </div>
              <footer>
                <time>
                  {lastMsgDate && `Last message received at ${lastMsgDate}`}
                </time>
              </footer>
            </div>
            <div className="user-avatar">
              <img src={avatarImg} alt="" />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Chat;
