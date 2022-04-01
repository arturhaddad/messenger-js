import './style.css';
import ArenaChat from '@arena-im/chat-sdk';
import React, {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChatMessage } from '@arena-im/chat-types/dist/chat-message';
import { BasePolls, Poll } from '@arena-im/chat-types/dist/polls';
import { BaseQna, MessageReaction, QnaQuestion } from '@arena-im/chat-types';
import { Channel } from '@arena-im/chat-sdk/dist/channel/channel';
import avatarImg from '../../assets/user-avatar.png';
import pollIcon from '../../assets/icons/poll.png';
import fontIcon from '../../assets/icons/font.png';
import qnaIcon from '../../assets/icons/qna.png';
import msgIcon from '../../assets/icons/msg.png';
import { slugify } from '../../helpers';

const CHAT_SLUG = 'novosite';
const CHAT_CHANNEL_ID = 'CA1MzfE';

// FIXME: This must be typed in the SDK library and shall be removed
// from here when it's updated
interface FixedChatMessage extends ChatMessage {
  question?: QnaQuestion;
}

const Chat = () => {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const mainChannelRef = useRef<Channel | null>(null);
  const pollsRef = useRef<BasePolls | null>(null);
  const qnaRef = useRef<BaseQna | null>(null);
  const [messages, setMessages] = useState<FixedChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingChannelMessages, setLoadingChannelMessages] = useState(false);
  const [loadingSendMessage, setLoadingSendMessage] = useState(false);
  const [loadingPoll, setLoadingPoll] = useState<Poll | null>(null);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [qnaMode, setQnaMode] = useState(false);
  const [currentTab, setCurrentTab] = useState('messages');

  const scrollMessagesToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  const handleLoadMessages = useCallback(async () => {
    if (mainChannelRef.current) {
      try {
        setLoadingChannelMessages(true);
        const recentMessages = await mainChannelRef.current.loadRecentMessages(
          20
        );
        setMessages(recentMessages);
      } catch (err) {
        console.error('Error (load messages):', err); // eslint-disable-line no-console
        alert('Error to load messages. See on console'); // eslint-disable-line no-alert
      } finally {
        setLoadingChannelMessages(false);
        scrollMessagesToBottom();
      }
    }
  }, []);

  const handleLoadPolls = useCallback(async () => {
    if (mainChannelRef.current) {
      try {
        setLoadingPolls(true);
        const userId = slugify(`${userName}-arena`);
        const pollsInstance = await mainChannelRef.current.getPollsInstance(
          userId
        );
        const newPolls = await pollsInstance.loadPolls();
        pollsRef.current = pollsInstance;
        setPolls(newPolls);
      } catch (err) {
        console.error('Error (load polls):', err); // eslint-disable-line no-console
        alert('Error to load polls. See on console'); // eslint-disable-line no-alert
        pollsRef.current = null;
        setPolls(null);
      } finally {
        setLoadingPolls(false);
      }
    }
  }, [userName]);

  const handleLoadQnaInstance = useCallback(async () => {
    if (mainChannelRef.current) {
      try {
        const qnaInstance = await mainChannelRef.current.getChatQnaInstance();

        qnaRef.current = qnaInstance;
      } catch (err) {
        qnaRef.current = null;
      }
    }
  }, []);

  const startListeners = useCallback(() => {
    if (mainChannelRef.current) {
      mainChannelRef.current.onMessageReceived((message) => {
        setMessages((oldValues) => [...oldValues, message]);
        scrollMessagesToBottom();
      });

      mainChannelRef.current.onMessageModified((modifiedMsg) => {
        setMessages((oldValues) =>
          oldValues.map((m) => {
            // FIXME: Considering only user reactions changed in local state
            // due to inconsistent return of currentUserReactions attribute
            // on onMessageModified event
            const newMsg = {
              ...modifiedMsg,
              currentUserReactions: m.currentUserReactions,
            };
            return m.key === modifiedMsg.key ? newMsg : m;
          })
        );
      });

      mainChannelRef.current.onMessageDeleted((message) => {
        setMessages((oldValues) =>
          oldValues.filter((item) => message.key !== item.key)
        );
      });
    }

    if (pollsRef.current) {
      pollsRef.current.onPollReceived((poll) => {
        setPolls((oldValues) => (oldValues ? [poll, ...oldValues] : [poll]));
      });

      pollsRef.current.onPollModified((poll) => {
        setPolls(
          (oldValues) =>
            oldValues?.map((item) => (item._id === poll._id ? poll : item)) ||
            null
        );
      });

      pollsRef.current.onPollDeleted((poll) => {
        setPolls(
          (oldValues) =>
            oldValues?.filter((item) => poll._id !== item._id) || null
        );
      });
    }
  }, []);

  const removeListeners = useCallback(() => {
    mainChannelRef.current?.offAllListeners();
  }, []);

  const connectChat = useCallback(async (username: string) => {
    try {
      setLoadingChat(true);
      const arenaChat = new ArenaChat(CHAT_SLUG);
      await arenaChat.setUser({
        id: slugify(`${username}-arena`),
        name: username,
        image: '',
      });

      const liveChatConnection = await arenaChat.getLiveChat(CHAT_CHANNEL_ID);
      mainChannelRef.current = liveChatConnection.getMainChannel();

      await handleLoadPolls();
      await handleLoadQnaInstance();
      await handleLoadMessages();

      startListeners();
    } catch (err) {
      console.error('Error (connect chat):', err); // eslint-disable-line no-console
      alert('Error to connect chat. See on console'); // eslint-disable-line no-alert
    } finally {
      setLoadingChat(false);
      scrollMessagesToBottom();
    }
  }, []);

  const handleChangeNewMessage = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
  };

  const isButtonDisabled =
    loadingChat ||
    loadingChannelMessages ||
    loadingSendMessage ||
    newMessage.length === 0;

  const handleSendMessage = async () => {
    if (mainChannelRef.current && !isButtonDisabled) {
      try {
        setLoadingSendMessage(true);
        await mainChannelRef.current.sendMessage({ text: newMessage });
        setNewMessage('');

        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      } catch (err) {
        console.error('Error (send message):', err); // eslint-disable-line no-console
        alert('Error to send message. See on console'); // eslint-disable-line no-alert
      } finally {
        setLoadingSendMessage(false);
      }
    }
  };

  const handleSendQuestion = async () => {
    if (qnaRef.current && !isButtonDisabled) {
      try {
        setLoadingSendMessage(true);
        await qnaRef.current.addQuestion(newMessage);
        setNewMessage('');
        setQnaMode(false);

        // eslint-disable-next-line no-alert
        alert(
          'Your question has been sent and will be displayed when a moderator answers.'
        );

        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      } catch (err) {
        console.error('Error (send question):', err); // eslint-disable-line no-console
        alert('Error to send question. See on console'); // eslint-disable-line no-alert
      } finally {
        setLoadingSendMessage(false);
      }
    }
  };

  const handleSubmitKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (qnaMode) {
        handleSendQuestion();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleLikeMsg = async (message: ChatMessage) => {
    if (mainChannelRef.current) {
      const reactionType = 'like';

      const reaction: MessageReaction = {
        type: reactionType,
        messageID: message.key,
      };

      mainChannelRef.current.sendReaction(reaction);
      // FIXME: Update currentUserReaction and like counter locally due
      // to inconsistent return of like attributes on onMessageModified event
      const likeCount = message.reactions?.like || 0;
      const newLikeCount = likeCount + 1;
      const likedMessage = {
        ...message,
        currentUserReactions: { like: true },
        reactions: { like: newLikeCount },
      };
      const newMessages = messages.map((e) =>
        e.key === message.key ? likedMessage : e
      );
      setMessages(newMessages);
    }
  };

  const handleDislikeMsg = async (message: ChatMessage) => {
    if (mainChannelRef.current) {
      const reactionType = 'like';

      const reaction: MessageReaction = {
        type: reactionType,
        messageID: message.key,
      };

      mainChannelRef.current.deleteReaction(reaction);
      // FIXME: Update currentUserReaction and like counter locally due
      // to inconsistent return of like attributes on onMessageModified event
      const likeCount = message.reactions?.like || 0;
      const newLikeCount = likeCount === 0 ? 0 : likeCount - 1;
      const dislikedMsg = {
        ...message,
        currentUserReactions: { like: false },
        reactions: { like: newLikeCount },
      };
      const newMessages = messages.map((e) =>
        e.key === message.key ? dislikedMsg : e
      );
      setMessages(newMessages);
    }
  };

  const userHasLikedMsg = (message: ChatMessage) => {
    const isLiked = message.currentUserReactions?.like;

    if (isLiked) {
      return true;
    }

    return false;
  };

  const userHasVoted = (poll: Poll) =>
    !!poll.currentUserVote || poll.currentUserVote === 0;

  const isPollLoading = (poll: Poll) => loadingPoll?._id === poll._id;

  const isVoteButtonDisabled = (poll: Poll) =>
    isPollLoading(poll) || userHasVoted(poll);

  const handleToggleLikeMsg = (message: ChatMessage) => {
    if (userHasLikedMsg(message)) {
      handleDislikeMsg(message);
    } else {
      handleLikeMsg(message);
    }
  };

  const handleVote = async (poll: Poll, voteIndex: number) => {
    if (pollsRef.current) {
      try {
        setLoadingPoll(poll);
        await pollsRef.current.pollVote(poll._id, voteIndex);
      } catch (err) {
        console.error('Error (vote):', err); // eslint-disable-line no-console
        alert('Error to vote. See on console'); // eslint-disable-line no-alert
      } finally {
        setLoadingPoll(null);
      }
    }
  };

  const handleEnableQnaMode = () => {
    setCurrentTab('messages');
    setQnaMode(true);
    inputRef.current?.focus();
  };

  const handleDisableQnaMode = () => {
    setCurrentTab('messages');
    setQnaMode(false);
    inputRef.current?.focus();
  };

  const handleChangeTab = (tab: string) => {
    setCurrentTab(tab);
  };

  useEffect(() => {
    scrollMessagesToBottom();
  }, [currentTab]);

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

  const findPoll = (poll: Poll) => polls?.find((p) => p._id === poll._id);
  const getVotePercentage = (poll: Poll, votes: number) => {
    if (poll.total === 0) {
      const optionsQty = Object.keys(poll.options).length;
      const equalPercentage = 100 / optionsQty;
      const roundEqualPercentage = Math.round(equalPercentage * 10) / 10;
      return roundEqualPercentage;
    }

    const votePercentage = (votes * 100) / poll.total || 0;
    const roundPercentage = Math.round(votePercentage * 10) / 10;
    return roundPercentage;
  };

  const showLoadingScreen = loadingChat || loadingChannelMessages;

  useEffect(() => {
    const chosenUsername = prompt('Please, enter a username:'); // eslint-disable-line no-alert
    setUserName(chosenUsername || 'Unamed-user-2139');
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (userName) {
      connectChat(userName);

      return () => {
        removeListeners();
      };
    }

    return () => {};
  }, [userName]);

  return (
    <div className="wrapper">
      <div className="container">
        <nav className="navbar" />
        <main>
          <section className="channel-container">
            <header>
              To:{' '}
              {mainChannelRef.current && (
                <strong>{mainChannelRef.current.channel.name}</strong>
              )}
            </header>
            {showLoadingScreen ? (
              <div className="loading-container">
                <div className="loader">
                  <span />
                </div>
              </div>
            ) : (
              <>
                <div className="messages-container" ref={chatRef}>
                  {currentTab === 'messages' && (
                    <>
                      {messages.map((m) => (
                        <div className="msg-wrapper" key={m.key}>
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
                                  className={`reaction-button is-liked-${userHasLikedMsg(
                                    m
                                  )}`}
                                  type="button"
                                  onClick={() => handleToggleLikeMsg(m)}
                                >
                                  <span className="msg-reaction-icon">♥</span>
                                  <span className="msg-reaction-counter">
                                    {m.reactions?.like || '0'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                          {m.poll && findPoll(m.poll) && (
                            <div
                              className={`poll-container poll-loading-${isPollLoading(
                                m.poll
                              )}`}
                            >
                              {isPollLoading(m.poll) && (
                                <div className="loading-container loading-poll">
                                  <div className="loader">
                                    <span />
                                  </div>
                                </div>
                              )}
                              <p className="poll-title">{m.poll.question}</p>
                              <div className="poll-options-container">
                                {Object.keys(m.poll.options).map((key, i) => (
                                  <button
                                    key={key}
                                    className={`poll-option-button poll-option-active-${
                                      findPoll(m.poll!)?.currentUserVote === i
                                    }`}
                                    type="button"
                                    onClick={() => handleVote(m.poll!, i)}
                                    disabled={isVoteButtonDisabled(
                                      findPoll(m.poll!)!
                                    )}
                                  >
                                    {m.poll?.options[i].name} (
                                    {getVotePercentage(
                                      findPoll(m.poll!)!,
                                      findPoll(m.poll!)?.options[i].total!
                                    )}
                                    %)
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {m.question && (
                            <div className="qna-container">
                              <button
                                type="button"
                                className="qna-icon-button"
                                onClick={handleEnableQnaMode}
                              >
                                <img
                                  className="qna-icon"
                                  src={qnaIcon}
                                  alt=""
                                />
                              </button>
                              <div className="qna-question-wrapper">
                                <div className="qna-question-container">
                                  <p className="qna-question-author">
                                    {m.question.sender.name}
                                  </p>
                                  <p className="qna-question-text">
                                    {m.question.text}
                                  </p>
                                </div>
                              </div>
                              <p className="qna-answer-text">
                                {m.question.answer.text}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                  {currentTab === 'polls' && (
                    <>
                      {polls && polls.length > 0 ? (
                        <>
                          {polls.map((p) => (
                            <div
                              className={`poll-container poll-loading-${isPollLoading(
                                p
                              )}`}
                              key={p._id}
                            >
                              {isPollLoading(p) && (
                                <div className="loading-container loading-poll">
                                  <div className="loader">
                                    <span />
                                  </div>
                                </div>
                              )}
                              <p className="poll-title">{p.question}</p>
                              <div className="poll-options-container">
                                {Object.keys(p.options).map((key, i) => (
                                  <button
                                    key={key}
                                    className={`poll-option-button poll-option-active-${
                                      p.currentUserVote === i
                                    }`}
                                    type="button"
                                    onClick={() => handleVote(p, i)}
                                    disabled={isVoteButtonDisabled(p)}
                                  >
                                    {p.options[i].name} (
                                    {getVotePercentage(p, p.options[i].total)}%)
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p>There are no polls yet.</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </section>
          <section className="user-container">
            <div className="new-message">
              <header>
                {currentTab === 'messages' && (
                  <button
                    type="button"
                    className="new-message-bar-button"
                    onClick={() => handleChangeTab('polls')}
                    disabled={loadingPolls}
                  >
                    <img src={pollIcon} alt="" title="See all polls" />
                  </button>
                )}
                {currentTab === 'polls' && (
                  <button
                    type="button"
                    className="new-message-bar-button"
                    onClick={() => handleChangeTab('messages')}
                  >
                    <img src={fontIcon} alt="" title="See all messages" />
                  </button>
                )}
                <button
                  type="button"
                  className="new-message-bar-button"
                  onClick={qnaMode ? handleDisableQnaMode : handleEnableQnaMode}
                >
                  <img
                    src={qnaMode ? msgIcon : qnaIcon}
                    title={qnaMode ? '' : 'Ask a question'}
                    alt=""
                  />
                </button>
              </header>
              <div className={`input-container qna-mode-${qnaMode}`}>
                <textarea
                  value={newMessage}
                  onChange={handleChangeNewMessage}
                  onKeyDown={handleSubmitKeyDown}
                  ref={inputRef}
                  disabled={loadingSendMessage}
                  style={{ color: stringToColor(userName) }}
                  placeholder={qnaMode ? 'Type your question...' : ''}
                />
                <div className="message-buttons-container">
                  <button
                    className="send-message-button"
                    type="button"
                    disabled={isButtonDisabled}
                    onClick={qnaMode ? handleSendQuestion : handleSendMessage}
                  >
                    {qnaMode ? 'Ask' : 'Send'}
                  </button>
                  {qnaMode && (
                    <button
                      className="cancel-question-button"
                      type="button"
                      onClick={handleDisableQnaMode}
                      disabled={loadingSendMessage}
                    >
                      Cancel
                    </button>
                  )}
                </div>
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
