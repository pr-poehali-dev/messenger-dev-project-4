import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { api } from '@/lib/api';
import { auth, User } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

type Message = {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  type: string;
  content: string;
  file_url?: string;
  file_name?: string;
  created_at: string;
  is_mine: boolean;
};

type Chat = {
  id: number;
  type: string;
  title: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
};

export default function Index() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = auth.getToken();
    const savedUser = auth.getUser();
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(savedUser);
      loadChats();
    }
  }, []);

  const handleSendCode = async () => {
    if (!phone.trim()) {
      toast({ title: 'Ошибка', description: 'Введите номер телефона', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const result = await api.sendSmsCode(phone);
      if (result.error) {
        toast({ title: 'Ошибка', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Успех', description: 'Код отправлен на ваш номер' });
        setStep('code');
        if (result.code) {
          toast({ title: 'DEV', description: `Код для теста: ${result.code}` });
        }
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось отправить код', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      toast({ title: 'Ошибка', description: 'Введите код из SMS', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const result = await api.verifyCode(phone, code);
      if (result.error) {
        toast({ title: 'Ошибка', description: result.error, variant: 'destructive' });
      } else {
        auth.setToken(result.token);
        auth.setUser(result.user);
        setUser(result.user);
        setIsAuthenticated(true);
        toast({ title: 'Добро пожаловать!', description: 'Вы успешно вошли' });
        loadChats();
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось войти', variant: 'destructive' });
    }
    setLoading(false);
  };

  const loadChats = async () => {
    const token = auth.getToken();
    if (!token) return;
    
    try {
      const result = await api.getChats(token);
      if (result.chats) {
        setChats(result.chats);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const loadMessages = async (chatId: number) => {
    const token = auth.getToken();
    if (!token) return;
    
    try {
      const result = await api.getMessages(token, chatId);
      if (result.messages) {
        setMessages(result.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    loadMessages(chat.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    const token = auth.getToken();
    if (!token) return;
    
    try {
      await api.sendMessage(token, {
        chat_id: selectedChat.id,
        content: newMessage,
        type: 'text',
      });
      
      setNewMessage('');
      loadMessages(selectedChat.id);
      loadChats();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось отправить сообщение', variant: 'destructive' });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    
    const token = auth.getToken();
    if (!token) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      
      try {
        const uploadResult = await api.uploadFile(token, base64, file.name, file.type);
        
        if (uploadResult.file_url) {
          await api.sendMessage(token, {
            chat_id: selectedChat.id,
            content: file.name,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            file_url: uploadResult.file_url,
            file_name: file.name,
          });
          
          loadMessages(selectedChat.id);
          loadChats();
          toast({ title: 'Успех', description: 'Файл отправлен' });
        }
      } catch (error) {
        toast({ title: 'Ошибка', description: 'Не удалось загрузить файл', variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSearchUsers = async () => {
    if (!searchPhone.trim()) return;
    
    const token = auth.getToken();
    if (!token) return;
    
    try {
      const result = await api.searchUsers(token, searchPhone);
      if (result.users) {
        setSearchResults(result.users);
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось найти пользователей', variant: 'destructive' });
    }
  };

  const handleStartChat = async (userId: number) => {
    const token = auth.getToken();
    if (!token) return;
    
    try {
      await api.sendMessage(token, {
        recipient_id: userId,
        content: 'Привет! 👋',
        type: 'text',
      });
      
      setShowSearch(false);
      setSearchPhone('');
      setSearchResults([]);
      loadChats();
      toast({ title: 'Успех', description: 'Чат создан' });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось создать чат', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    auth.removeToken();
    setIsAuthenticated(false);
    setUser(null);
    setChats([]);
    setMessages([]);
    setSelectedChat(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-2xl bg-primary mx-auto flex items-center justify-center text-primary-foreground text-3xl font-bold mb-4">
              BC
            </div>
            <h1 className="text-3xl font-bold">BizChat</h1>
            <p className="text-muted-foreground">Корпоративный мессенджер</p>
          </div>

          {step === 'phone' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Номер телефона</label>
                <Input
                  type="tel"
                  placeholder="+7 999 123-45-67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                />
              </div>
              <Button onClick={handleSendCode} disabled={loading} className="w-full">
                {loading ? 'Отправка...' : 'Получить код'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Код из SMS</label>
                <Input
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  maxLength={6}
                />
              </div>
              <Button onClick={handleVerifyCode} disabled={loading} className="w-full">
                {loading ? 'Проверка...' : 'Войти'}
              </Button>
              <Button onClick={() => setStep('phone')} variant="ghost" className="w-full">
                Изменить номер
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedChat) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="h-14 px-4 border-b border-border flex items-center gap-3 bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)}>
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={selectedChat.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {selectedChat.title.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{selectedChat.title}</h3>
            <p className="text-xs text-muted-foreground">В сети</p>
          </div>
          <Button variant="ghost" size="icon">
            <Icon name="Phone" size={18} />
          </Button>
          <Button variant="ghost" size="icon">
            <Icon name="Video" size={18} />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.is_mine
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.type === 'image' && message.file_url && (
                    <img src={message.file_url} alt="" className="rounded-lg mb-2 max-w-full" />
                  )}
                  {message.type === 'file' && (
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="File" size={16} />
                      <span className="text-xs">{message.file_name}</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border bg-card">
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="Paperclip" size={18} />
            </Button>
            <Input
              placeholder="Сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} size="icon">
              <Icon name="Send" size={18} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Чаты</h2>
                <Button size="icon" variant="ghost" onClick={() => setShowSearch(true)}>
                  <Icon name="UserPlus" size={20} />
                </Button>
              </div>
              <div className="relative">
                <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Поиск..." className="pl-10" />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className="w-full p-4 flex items-start gap-3 hover:bg-accent/50 transition-colors border-b border-border"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={chat.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {chat.title.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{chat.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {chat.last_message_time && new Date(chat.last_message_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{chat.last_message || 'Нет сообщений'}</p>
                  </div>

                  {chat.unread_count > 0 && (
                    <Badge className="bg-primary text-primary-foreground shrink-0 mt-1">
                      {chat.unread_count}
                    </Badge>
                  )}
                </button>
              ))}
            </ScrollArea>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="h-full flex items-center justify-center text-muted-foreground p-4">
            <div className="text-center">
              <Icon name="Users" size={48} className="mx-auto mb-4 opacity-50" />
              <p>Контакты в разработке</p>
              <Button onClick={() => setShowSearch(true)} className="mt-4">
                Найти пользователей
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Icon name="Phone" size={48} className="mx-auto mb-4 opacity-50" />
              <p>Звонки в разработке</p>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div className="text-center space-y-4">
                <Avatar className="w-24 h-24 mx-auto">
                  <AvatarImage src={user?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                    {user?.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{user?.full_name}</h2>
                  <p className="text-muted-foreground">{user?.phone}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <button
                  onClick={() => { setEditName(user?.full_name || ''); setShowProfile(true); }}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="User" size={18} className="text-muted-foreground" />
                    <span>Редактировать профиль</span>
                  </div>
                  <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
                </button>

                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <Icon name="Bell" size={18} className="text-muted-foreground" />
                    <span>Уведомления</span>
                  </div>
                  <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
                </button>

                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <Icon name="Lock" size={18} className="text-muted-foreground" />
                    <span>Приватность</span>
                  </div>
                  <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
                </button>
              </div>

              <Separator />

              <Button variant="destructive" className="w-full" onClick={handleLogout}>
                <Icon name="LogOut" size={18} className="mr-2" />
                Выйти
              </Button>
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="h-16 border-t border-border bg-card flex items-center justify-around px-2">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'chats' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon name="MessageSquare" size={22} />
          <span className="text-xs">Чаты</span>
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'contacts' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon name="Users" size={22} />
          <span className="text-xs">Контакты</span>
        </button>

        <button
          onClick={() => setActiveTab('calls')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'calls' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon name="Phone" size={22} />
          <span className="text-xs">Звонки</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'profile' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon name="User" size={22} />
          <span className="text-xs">Профиль</span>
        </button>
      </div>

      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Найти пользователя</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Введите номер телефона"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
              <Button onClick={handleSearchUsers}>
                <Icon name="Search" size={18} />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.phone}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleStartChat(user.id)}>
                      Написать
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать профиль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Имя</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <Button className="w-full">Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
