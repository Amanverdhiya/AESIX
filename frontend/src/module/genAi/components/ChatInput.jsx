import React from 'react';

export const ChatInput = ({
  inputMessage,
  setInputMessage,
  handleSendMessage,
  loading,
  isVoiceActive,
  toggleVoiceMode,
  onOpenVoiceToVoice,
  language = 'en',
}) => {
  const getPlaceholder = () => {
    if (language === 'hi') return 'अपनी चिकित्सा समस्या लिखें या वॉयस बातचीत शुरू करें...';
    if (language === 'bn') return 'আপনার চিকিৎসা বিষয়ক প্রশ্ন লিখুন বা ভয়েস চ্যাট শুরু করুন...';
    if (language === 'ta') return 'உங்கள் மருத்துவக் கேள்வியை எழுதவும் அல்லது குரல் உரையாடலைத் தொடங்கவும்...';
    return 'Type your medical query or start voice conversation...';
  };

  return (
    <form className="chat-input-form" onSubmit={handleSendMessage}>
      <div className="input-box-wrapper">
        <input
          type="text"
          className="chat-text-input"
          placeholder={getPlaceholder()}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
        />

        {/* Right Side Controls Container */}
        <div className="input-right-controls">
          {/* Voice-to-Voice Convo Mode Button */}
          {onOpenVoiceToVoice && (
            <button
              type="button"
              className="control-btn voice-to-voice-btn"
              onClick={onOpenVoiceToVoice}
              title="Launch Voice to Voice Conversation Mode"
            >
              <span className="btn-icon">🎙️⚡</span>
              <span className="btn-label">Voice Convo</span>
            </button>
          )}

          {/* Unified Dynamic Mic / Send Action Button */}
          {inputMessage.trim() ? (
            <button
              type="submit"
              className="send-btn"
              disabled={loading}
              title="Send Message"
            >
              <span>Send</span>
              <span className="send-icon">➤</span>
            </button>
          ) : (
            <button
              type="button"
              className={`control-btn voice-chat-btn ${isVoiceActive ? 'active listening' : ''}`}
              onClick={toggleVoiceMode}
              onMouseDown={() => !isVoiceActive && toggleVoiceMode()}
              onTouchStart={() => !isVoiceActive && toggleVoiceMode()}
              title={isVoiceActive ? 'Stop Mic Recording' : 'Tap or Hold to Speak'}
            >
              {isVoiceActive ? (
                <>
                  <span className="btn-icon mic-pulse" style={{ color: '#EF4444' }}>🎙️</span>
                  <span className="btn-label">Listening...</span>
                </>
              ) : (
                <>
                  <span className="btn-icon">🎙️</span>
                  <span className="btn-label">Mic</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default ChatInput;
