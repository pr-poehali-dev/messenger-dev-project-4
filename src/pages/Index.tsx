import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';

type Message = {
  id: number;
  text: string;
  sender: 'me' | 'other';
  time: string;
};

type Chat = {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
};

const mockChats: Chat[] = [
  {
    id: 1,
    name: 'Александр Петров',
    avatar: '',
    lastMessage: 'Отправил отчет по проекту',
    time: '14:32',
    unread: 2,
    online: true,
  },
  {
    id: 2,
    name: 'Мария Соколова',
    avatar: '',
    lastMessage: 'Созвон в 15:00?',
    time: '13:15',
    unread: 0,
    online: true,
  },
  {
    id: 3,
    name: 'Команда разработки',
    avatar: '',
    lastMessage: 'Иван: Готово к ревью',
    time: '12:45',
    unread: 5,
    online: false,
  },
  {
    id: 4,
    name: 'Дмитрий Ковалев',
    avatar: '',
    lastMessage: 'Спасибо за документы',
    time: 'Вчера',
    unread: 0,
    online: false,
  },
];

const mockMessages: Message[] = [
  { id: 1, text: 'Добрый день! Как продвигается проект?', sender: 'other', time: '14:25' },
  { id: 2, text: 'Здравствуйте! Все идет по плану, отчет готов', sender: 'me', time: '14:28' },
  { id: 3, text: 'Отправил отчет по проекту', sender: 'other', time: '14:32' },
];

export default function Index() {
  const [isDark, setIsDark] = useState(false);
  const [activeSection, setActiveSection] = useState('chats');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(mockChats[0]);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message: Message = {
        id: messages.length + 1,
        text: newMessage,
        sender: 'me',
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, message]);
      setNewMessage('');
    }
  };

  const sections = [
    { id: 'chats', label: 'Чаты', icon: 'MessageSquare' },
    { id: 'contacts', label: 'Контакты', icon: 'Users' },
    { id: 'calls', label: 'Звонки', icon: 'Phone' },
    { id: 'groups', label: 'Группы', icon: 'Users2' },
    { id: 'profile', label: 'Профиль', icon: 'User' },
  ];

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 gap-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
          BC
        </div>
        
        <Separator className="w-8" />
        
        <nav className="flex flex-col gap-4 flex-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                activeSection === section.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
              title={section.label}
            >
              <Icon name={section.icon as any} size={20} />
            </button>
          ))}
        </nav>

        <button
          onClick={toggleTheme}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-all"
          title={isDark ? 'Светлая тема' : 'Темная тема'}
        >
          <Icon name={isDark ? 'Sun' : 'Moon'} size={20} />
        </button>
      </aside>

      {activeSection === 'chats' && (
        <>
          <div className="w-80 bg-card border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-semibold mb-3">Чаты</h2>
              <div className="relative">
                <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Поиск чатов..." className="pl-10" />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {mockChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-accent/50 transition-colors border-b border-border ${
                    selectedChat?.id === chat.id ? 'bg-accent/30' : ''
                  }`}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={chat.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {chat.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    {chat.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm truncate">{chat.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{chat.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                  </div>

                  {chat.unread > 0 && (
                    <Badge className="bg-primary text-primary-foreground shrink-0 mt-1">
                      {chat.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedChat.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {selectedChat.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{selectedChat.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedChat.online ? 'В сети' : 'Был(а) недавно'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Icon name="Phone" size={18} />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Icon name="Video" size={18} />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Icon name="MoreVertical" size={18} />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-4 animate-fade-in">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            message.sender === 'me'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="text-sm">{message.text}</p>
                          <span className="text-xs opacity-70 mt-1 block">{message.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border bg-card">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Icon name="Paperclip" size={18} />
                    </Button>
                    <Input
                      placeholder="Введите сообщение..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} size="icon">
                      <Icon name="Send" size={18} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Icon name="MessageSquare" size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Выберите чат для начала общения</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeSection === 'profile' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6 animate-fade-in">
            <div className="text-center space-y-4">
              <Avatar className="w-32 h-32 mx-auto">
                <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                  ИП
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-semibold">Иван Петров</h2>
                <p className="text-muted-foreground">+7 (999) 123-45-67</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Icon name="User" size={18} className="text-muted-foreground" />
                  <span>Редактировать профиль</span>
                </div>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Icon name="Bell" size={18} className="text-muted-foreground" />
                  <span>Уведомления</span>
                </div>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Icon name="Lock" size={18} className="text-muted-foreground" />
                  <span>Приватность и безопасность</span>
                </div>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Icon name="Settings" size={18} className="text-muted-foreground" />
                  <span>Параметры</span>
                </div>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
              </div>
            </div>

            <Separator />

            <Button variant="destructive" className="w-full">
              <Icon name="LogOut" size={18} className="mr-2" />
              Выйти из профиля
            </Button>
          </div>
        </div>
      )}

      {(activeSection === 'contacts' || activeSection === 'calls' || activeSection === 'groups') && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center animate-fade-in">
            <Icon 
              name={activeSection === 'contacts' ? 'Users' : activeSection === 'calls' ? 'Phone' : 'Users2'} 
              size={48} 
              className="mx-auto mb-4 opacity-50" 
            />
            <p className="text-lg">Раздел "{sections.find(s => s.id === activeSection)?.label}" в разработке</p>
          </div>
        </div>
      )}
    </div>
  );
}
