import json
import os
import psycopg2
from datetime import datetime
import jwt

def handler(event: dict, context) -> dict:
    '''
    API для работы с сообщениями: отправка, получение истории чата, поиск пользователей
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Authorization'
            },
            'body': ''
        }
    
    token = event.get('headers', {}).get('X-Authorization', '').replace('Bearer ', '')
    if not token:
        return error_response('Authorization required', 401)
    
    try:
        payload = jwt.decode(token, os.environ['JWT_SECRET'], algorithms=['HS256'])
        user_id = payload['user_id']
    except:
        return error_response('Invalid token', 401)
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'get_chats')
            
            if action == 'get_chats':
                cur.execute(
                    f"""
                    SELECT DISTINCT c.id, c.chat_type, c.title, c.avatar_url,
                           (SELECT content FROM {os.environ['MAIN_DB_SCHEMA']}.messages 
                            WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                           (SELECT created_at FROM {os.environ['MAIN_DB_SCHEMA']}.messages 
                            WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                           (SELECT COUNT(*) FROM {os.environ['MAIN_DB_SCHEMA']}.messages m
                            WHERE m.chat_id = c.id AND m.sender_id != %s 
                            AND NOT EXISTS (
                                SELECT 1 FROM {os.environ['MAIN_DB_SCHEMA']}.message_reads mr 
                                WHERE mr.message_id = m.id AND mr.user_id = %s
                            )) as unread_count
                    FROM {os.environ['MAIN_DB_SCHEMA']}.chats c
                    INNER JOIN {os.environ['MAIN_DB_SCHEMA']}.chat_members cm ON c.id = cm.chat_id
                    WHERE cm.user_id = %s
                    ORDER BY last_message_time DESC NULLS LAST
                    """,
                    (user_id, user_id, user_id)
                )
                
                chats = []
                for row in cur.fetchall():
                    chat_id, chat_type, title, avatar_url, last_message, last_message_time, unread_count = row
                    
                    if chat_type == 'private':
                        cur.execute(
                            f"""
                            SELECT u.id, u.full_name, u.avatar_url, u.is_online
                            FROM {os.environ['MAIN_DB_SCHEMA']}.users u
                            INNER JOIN {os.environ['MAIN_DB_SCHEMA']}.chat_members cm ON u.id = cm.user_id
                            WHERE cm.chat_id = %s AND u.id != %s
                            """,
                            (chat_id, user_id)
                        )
                        other_user = cur.fetchone()
                        if other_user:
                            title = other_user[1]
                            avatar_url = other_user[2]
                    
                    chats.append({
                        'id': chat_id,
                        'type': chat_type,
                        'title': title,
                        'avatar_url': avatar_url,
                        'last_message': last_message,
                        'last_message_time': str(last_message_time) if last_message_time else None,
                        'unread_count': unread_count
                    })
                
                return success_response({'chats': chats})
            
            elif action == 'get_messages':
                chat_id = event.get('queryStringParameters', {}).get('chat_id')
                if not chat_id:
                    return error_response('chat_id required', 400)
                
                cur.execute(
                    f"""
                    SELECT m.id, m.sender_id, m.msg_type, m.content, m.file_url, 
                           m.file_name, m.created_at, u.full_name, u.avatar_url
                    FROM {os.environ['MAIN_DB_SCHEMA']}.messages m
                    INNER JOIN {os.environ['MAIN_DB_SCHEMA']}.users u ON m.sender_id = u.id
                    WHERE m.chat_id = %s
                    ORDER BY m.created_at ASC
                    """,
                    (chat_id,)
                )
                
                messages = []
                for row in cur.fetchall():
                    msg_id, sender_id, msg_type, content, file_url, file_name, created_at, sender_name, sender_avatar = row
                    messages.append({
                        'id': msg_id,
                        'sender_id': sender_id,
                        'sender_name': sender_name,
                        'sender_avatar': sender_avatar,
                        'type': msg_type,
                        'content': content,
                        'file_url': file_url,
                        'file_name': file_name,
                        'created_at': str(created_at),
                        'is_mine': sender_id == user_id
                    })
                
                return success_response({'messages': messages})
            
            elif action == 'search_users':
                phone = event.get('queryStringParameters', {}).get('phone', '').strip()
                if not phone:
                    return error_response('phone required', 400)
                
                cur.execute(
                    f"""
                    SELECT id, phone, full_name, avatar_url, status, is_online
                    FROM {os.environ['MAIN_DB_SCHEMA']}.users
                    WHERE phone LIKE %s AND id != %s
                    LIMIT 20
                    """,
                    (f'%{phone}%', user_id)
                )
                
                users = []
                for row in cur.fetchall():
                    users.append({
                        'id': row[0],
                        'phone': row[1],
                        'full_name': row[2],
                        'avatar_url': row[3],
                        'status': row[4],
                        'is_online': row[5]
                    })
                
                return success_response({'users': users})
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'send_message':
                chat_id = body.get('chat_id')
                recipient_id = body.get('recipient_id')
                msg_type = body.get('type', 'text')
                content = body.get('content', '')
                file_url = body.get('file_url')
                file_name = body.get('file_name')
                
                if not chat_id and not recipient_id:
                    return error_response('chat_id or recipient_id required', 400)
                
                if not chat_id:
                    cur.execute(
                        f"""
                        SELECT c.id FROM {os.environ['MAIN_DB_SCHEMA']}.chats c
                        INNER JOIN {os.environ['MAIN_DB_SCHEMA']}.chat_members cm1 ON c.id = cm1.chat_id
                        INNER JOIN {os.environ['MAIN_DB_SCHEMA']}.chat_members cm2 ON c.id = cm2.chat_id
                        WHERE c.chat_type = 'private' AND cm1.user_id = %s AND cm2.user_id = %s
                        LIMIT 1
                        """,
                        (user_id, recipient_id)
                    )
                    existing_chat = cur.fetchone()
                    
                    if existing_chat:
                        chat_id = existing_chat[0]
                    else:
                        cur.execute(
                            f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.chats (chat_type, created_by) VALUES ('private', %s) RETURNING id",
                            (user_id,)
                        )
                        chat_id = cur.fetchone()[0]
                        
                        cur.execute(
                            f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)",
                            (chat_id, user_id, chat_id, recipient_id)
                        )
                
                cur.execute(
                    f"""
                    INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.messages 
                    (chat_id, sender_id, msg_type, content, file_url, file_name)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                    """,
                    (chat_id, user_id, msg_type, content, file_url, file_name)
                )
                
                msg_id, created_at = cur.fetchone()
                conn.commit()
                
                return success_response({
                    'message_id': msg_id,
                    'chat_id': chat_id,
                    'created_at': str(created_at)
                })
            
            elif action == 'create_group':
                title = body.get('title', '')
                member_ids = body.get('member_ids', [])
                
                if not title or not member_ids:
                    return error_response('title and member_ids required', 400)
                
                cur.execute(
                    f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.chats (chat_type, title, created_by) VALUES ('group', %s, %s) RETURNING id",
                    (title, user_id)
                )
                chat_id = cur.fetchone()[0]
                
                members = [(chat_id, user_id, 'admin')]
                for mid in member_ids:
                    members.append((chat_id, mid, 'member'))
                
                cur.executemany(
                    f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.chat_members (chat_id, user_id, member_role) VALUES (%s, %s, %s)",
                    members
                )
                
                conn.commit()
                
                return success_response({'chat_id': chat_id})
        
        return error_response('Invalid request', 400)
    
    finally:
        cur.close()
        conn.close()


def success_response(data: dict):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(data)
    }


def error_response(message: str, status_code: int = 400):
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': message})
    }
