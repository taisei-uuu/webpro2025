document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');    
    const chatToggleButton = document.getElementById('chat-toggle-button');    
    const closeChatButton = document.getElementById('close-chat');    
    const chatMessages = document.getElementById('chat-messages');    
    const chatInput = document.getElementById('chat-input');    
    const chatSendButton = document.getElementById('chat-send');    
    // 会話の履歴を保持する配列    
    let chatHistory = [];    
    const toggleChatWindow = () => {        
    chatWindow.classList.toggle('hidden');        
    // チャットを開いたときに最初のメッセージを表示        
        if (!chatWindow.classList.contains('hidden') && chatHistory.length === 0) {            
    // 初期メッセージを送信する            
        handleInitialMessage();        
    }    
};    
chatToggleButton.addEventListener('click', toggleChatWindow);    
closeChatButton.addEventListener('click', toggleChatWindow);    
const addMessage = (message, sender) => {        
    const messageElement = document.createElement('div');        
    messageElement.classList.add('chat-message', `${sender}-message`);        
    // テキスト内の改行を<br>に変換        
    messageElement.innerHTML = message.replace(/\n/g, '<br>');        
    chatMessages.appendChild(messageElement);        
    chatMessages.scrollTop = chatMessages.scrollHeight;        
    // 履歴に追加 (botからの初期免責事項は履歴に含めない)        
        if (!(sender === 'bot' && message.includes('【免責事項】'))) {            
            chatHistory.push({ role: sender === 'user' ? 'user' : 'model', parts: [{ text: message }] });        
        }    
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
                // メッセージと履歴を送信                
                body: JSON.stringify({ message, history: chatHistory }),            
            });            
            if (!response.ok) {                
                throw new Error('Network response was not ok');            
            }            
            const data = await response.json();            
            addMessage(data.response, 'bot');        
        } catch (error) {            
            console.error('Error:', error);            
            addMessage('エラーが発生しました。もう一度お試しください。', 'bot');        
        } finally {            
            chatSendButton.disabled = false;           
            chatSendButton.textContent = '送信';        
        }    
    };    
    // 初期メッセージを送信する関数    
    const handleInitialMessage = async () => {        
        // ローディング表示        
        addMessage('AIが準備中です...', 'bot');        
        try {            
            const response = await fetch('/api/chat/initial-message');            
            if (!response.ok) {                
                throw new Error('Network response was not ok');            
            }            
            const data = await response.json();            
            // 免責事項と質問の候補を表示            
            const initialMessage = `${data.disclaimer}\n\n${data.questionPrompt}\n${data.questions.map(q => `- ${q}`).join('\n')}`;            
            addMessage(initialMessage, 'bot');        
        } catch (error) {            
            console.error('Error fetching initial message:', error);            
            addMessage('最初のメッセージの読み込みに失敗しました。', 'bot');        
        }    
    };    
    chatSendButton.addEventListener('click', handleSendMessage);    
    chatInput.addEventListener('keypress', (e) => {        
        if (e.key === 'Enter') {            
            handleSendMessage();        
        }    
    });
});