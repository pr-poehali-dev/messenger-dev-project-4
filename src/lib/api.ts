const API_URLS = {
  auth: 'https://functions.poehali.dev/1cf9506e-aff6-4778-984f-502bb7d316c2',
  messages: 'https://functions.poehali.dev/957e2ab9-1743-48ed-91b3-491163ffdc5b',
  upload: 'https://functions.poehali.dev/71d88d48-ed84-4a03-8998-33bafa023f1e',
};

export const api = {
  async sendSmsCode(phone: string) {
    const response = await fetch(API_URLS.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_code', phone }),
    });
    return response.json();
  },

  async verifyCode(phone: string, code: string, deviceInfo: string = navigator.userAgent) {
    const response = await fetch(API_URLS.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_code', phone, code, device_info: deviceInfo }),
    });
    return response.json();
  },

  async verifyToken(token: string) {
    const response = await fetch(API_URLS.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_token', token }),
    });
    return response.json();
  },

  async getChats(token: string) {
    const response = await fetch(`${API_URLS.messages}?action=get_chats`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async getMessages(token: string, chatId: number) {
    const response = await fetch(`${API_URLS.messages}?action=get_messages&chat_id=${chatId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async sendMessage(token: string, data: { chat_id?: number; recipient_id?: number; type?: string; content: string; file_url?: string; file_name?: string }) {
    const response = await fetch(API_URLS.messages, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'send_message', ...data }),
    });
    return response.json();
  },

  async searchUsers(token: string, phone: string) {
    const response = await fetch(`${API_URLS.messages}?action=search_users&phone=${encodeURIComponent(phone)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  async uploadFile(token: string, fileData: string, fileName: string, fileType: string) {
    const response = await fetch(API_URLS.upload, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ file_data: fileData, file_name: fileName, file_type: fileType }),
    });
    return response.json();
  },
};
