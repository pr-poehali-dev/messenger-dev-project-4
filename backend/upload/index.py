import json
import os
import boto3
import base64
from datetime import datetime
import uuid

def handler(event: dict, context) -> dict:
    '''
    API для загрузки файлов, изображений и голосовых сообщений в S3
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Authorization'
            },
            'body': ''
        }
    
    if method != 'POST':
        return error_response('Method not allowed', 405)
    
    token = event.get('headers', {}).get('X-Authorization', '')
    if not token:
        return error_response('Authorization required', 401)
    
    body = json.loads(event.get('body', '{}'))
    file_data = body.get('file_data', '')
    file_name = body.get('file_name', f'file_{uuid.uuid4()}')
    file_type = body.get('file_type', 'application/octet-stream')
    
    if not file_data:
        return error_response('file_data required', 400)
    
    try:
        file_bytes = base64.b64decode(file_data)
    except:
        return error_response('Invalid base64 data', 400)
    
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    key = f'messenger/{timestamp}_{file_name}'
    
    try:
        s3.put_object(
            Bucket='files',
            Key=key,
            Body=file_bytes,
            ContentType=file_type
        )
        
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        
        return success_response({
            'file_url': cdn_url,
            'file_name': file_name,
            'file_size': len(file_bytes)
        })
    
    except Exception as e:
        return error_response(f'Upload failed: {str(e)}', 500)


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
