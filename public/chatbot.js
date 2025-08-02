document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const chatToggleButton = document.getElementById('chat-toggle-button');
    const closeChatButton = document.getElementById('close-chat');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('chat-send');

    const toggleChatWindow = () => {
        chatWindow.classList.toggle('hidden');
    };

    chatToggleButton.addEventListener('click', toggleChatWindow);
    closeChatButton.addEventListener('click', toggleChatWindow);

    const addMessage = (message, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleSendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        chatInput.value = '';
        chatSendButton.disabled = true;
        chatSendButton.textContent = 'AIが考え中...';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                throw new Error('APIからの応答がありません。');
            }

            const data = await response.json();
            addMessage(data.reply, 'bot');
        } catch (error) {
            addMessage('エラーが発生しました。しばらくしてからもう一度お試しください。', 'bot');
        } finally {
            chatSendButton.disabled = false;
            chatSendButton.textContent = '送信';
        }
    };

    chatSendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
});
