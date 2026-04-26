import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { dealsApi } from '../api';
import { useWebSocket, createWebSocketUrl } from '../hooks/useWebSocket';
import './ChatWindow.css';

interface Message {
  id: string;
  content: string;
  senderId: string;
  type: 'text' | 'system';
  createdAt: string;
}

interface ChatWindowProps {
  dealId: string;
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ dealId, otherUser }) => {
  const { user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wsUrl = createWebSocketUrl(
    import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001',
    dealId,
    localStorage.getItem('auth_token') || '',
  );

  const { send: wsSend } = useWebSocket({
    url: wsUrl,
    onMessage: (msg) => {
      if (msg.type === 'message') {
        setMessages((prev) => [...prev, msg.payload]);
      }
    },
  });

  useEffect(() => {
    loadMessages();
  }, [dealId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await dealsApi.getMessages(dealId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      await dealsApi.sendMessage(dealId, input);
      setInput('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 2000);
    }
  };

  const isOwnMessage = (senderId: string) => senderId === user?.id;

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-avatar">
          {otherUser.avatar ? (
            <img src={otherUser.avatar} alt={otherUser.name} />
          ) : (
            <span>{otherUser.name[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">{otherUser.name}</span>
          <span className="chat-header-status">В сети</span>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${isOwnMessage(msg.senderId) ? 'own' : 'other'}`}
          >
            <div className="chat-message-content">
              {msg.content}
              <span className="chat-message-time">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
        />
        <button onClick={handleSend} disabled={!input.trim()}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};