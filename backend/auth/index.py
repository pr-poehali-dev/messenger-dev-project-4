import json
import os
import random
import psycopg2
from datetime import datetime, timedelta
import jwt
import hashlib

def handler(event: dict, context) -> dict:
    '''
    API для аутентификации: отправка SMS-кода, верификация и получение JWT токена
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body = json.loads(event.get('body', '{}'))
    action = body.get('action')
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if action == 'send_code':
            phone = body.get('phone', '').strip()
            if not phone:
                return error_response('Phone is required', 400)
            
            code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
            expires_at = datetime.now() + timedelta(minutes=10)
            
            cur.execute(
                f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.sms_codes (phone, code, expires_at) VALUES (%s, %s, %s)",
                (phone, code, expires_at)
            )
            conn.commit()
            
            send_sms(phone, f'BizChat код: {code}')
            
            return success_response({
                'message': 'SMS code sent',
                'expires_in': 600,
                'code': code
            })
        
        elif action == 'verify_code':
            phone = body.get('phone', '').strip()
            code = body.get('code', '').strip()
            device_info = body.get('device_info', '')
            
            if not phone or not code:
                return error_response('Phone and code are required', 400)
            
            cur.execute(
                f"""
                SELECT id FROM {os.environ['MAIN_DB_SCHEMA']}.sms_codes 
                WHERE phone = %s AND code = %s AND expires_at > NOW() AND verified = false
                ORDER BY created_at DESC LIMIT 1
                """,
                (phone, code)
            )
            
            sms_record = cur.fetchone()
            if not sms_record:
                return error_response('Invalid or expired code', 400)
            
            cur.execute(
                f"UPDATE {os.environ['MAIN_DB_SCHEMA']}.sms_codes SET verified = true WHERE id = %s",
                (sms_record[0],)
            )
            
            cur.execute(
                f"SELECT id, full_name, avatar_url, status FROM {os.environ['MAIN_DB_SCHEMA']}.users WHERE phone = %s",
                (phone,)
            )
            user = cur.fetchone()
            
            if not user:
                cur.execute(
                    f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.users (phone, full_name) VALUES (%s, %s) RETURNING id, full_name, avatar_url, status",
                    (phone, 'User')
                )
                user = cur.fetchone()
            
            user_id, full_name, avatar_url, status = user
            
            token = generate_jwt(user_id)
            expires_at = datetime.now() + timedelta(days=30)
            
            cur.execute(
                f"INSERT INTO {os.environ['MAIN_DB_SCHEMA']}.sessions (user_id, token, device_info, expires_at) VALUES (%s, %s, %s, %s)",
                (user_id, token, device_info, expires_at)
            )
            
            cur.execute(
                f"UPDATE {os.environ['MAIN_DB_SCHEMA']}.users SET is_online = true WHERE id = %s",
                (user_id,)
            )
            
            conn.commit()
            
            return success_response({
                'token': token,
                'user': {
                    'id': user_id,
                    'phone': phone,
                    'full_name': full_name,
                    'avatar_url': avatar_url,
                    'status': status
                }
            })
        
        elif action == 'verify_token':
            token = body.get('token', '')
            if not token:
                return error_response('Token is required', 400)
            
            try:
                payload = jwt.decode(token, os.environ['JWT_SECRET'], algorithms=['HS256'])
                user_id = payload['user_id']
                
                cur.execute(
                    f"SELECT id FROM {os.environ['MAIN_DB_SCHEMA']}.sessions WHERE token = %s AND expires_at > NOW()",
                    (token,)
                )
                
                if not cur.fetchone():
                    return error_response('Invalid or expired token', 401)
                
                cur.execute(
                    f"SELECT id, phone, full_name, avatar_url, status FROM {os.environ['MAIN_DB_SCHEMA']}.users WHERE id = %s",
                    (user_id,)
                )
                user = cur.fetchone()
                
                if not user:
                    return error_response('User not found', 404)
                
                return success_response({
                    'user': {
                        'id': user[0],
                        'phone': user[1],
                        'full_name': user[2],
                        'avatar_url': user[3],
                        'status': user[4]
                    }
                })
            except jwt.ExpiredSignatureError:
                return error_response('Token expired', 401)
            except jwt.InvalidTokenError:
                return error_response('Invalid token', 401)
        
        else:
            return error_response('Invalid action', 400)
    
    finally:
        cur.close()
        conn.close()


def send_sms(phone: str, message: str):
    sms_api_key = os.environ.get('SMS_API_KEY', '')
    if not sms_api_key:
        print(f'[DEV MODE] SMS to {phone}: {message}')
        return
    
    import requests
    response = requests.post(
        'https://smsc.ru/sys/send.php',
        data={
            'login': 'api',
            'psw': sms_api_key,
            'phones': phone,
            'mes': message,
            'fmt': 3
        }
    )
    print(f'SMS sent to {phone}: {response.json()}')


def generate_jwt(user_id: int) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, os.environ['JWT_SECRET'], algorithm='HS256')


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
