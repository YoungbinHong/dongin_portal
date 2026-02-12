from sqlalchemy.orm import Session
from models import ChatMessage, ChatRoomMember, ChatFile, User, ChatReadReceipt
from logger import logger

active_connections = {}
user_connections = {}

async def get_room_connections(room_id: str):
    """채팅방의 모든 연결 반환"""
    return active_connections.get(room_id, {})

async def register_connection(room_id: str, user_id: int, websocket):
    """채팅방에 연결 등록"""
    if room_id not in active_connections:
        active_connections[room_id] = {}
    active_connections[room_id][user_id] = websocket
    logger.info(f"[WebSocket 연결] 방: {room_id} | 사용자: {user_id}")

async def unregister_connection(room_id: str, user_id: int):
    """연결 해제"""
    if room_id in active_connections and user_id in active_connections[room_id]:
        del active_connections[room_id][user_id]
        if not active_connections[room_id]:
            del active_connections[room_id]
        logger.info(f"[WebSocket 해제] 방: {room_id} | 사용자: {user_id}")

async def handle_message(data: dict, user: User, room_id: str, websocket, db: Session):
    """텍스트 메시지 처리"""
    logger.info(f"[handle_message] 사용자: {user.id} | 방: {room_id}")
    if not room_id:
        logger.error(f"[handle_message 실패] 사용자: {user.id} | 방 ID 없음")
        await websocket.send_json({"type": "error", "message": "채팅방에 입장하지 않음"})
        return

    content = data.get("content")
    reply_to = data.get("reply_to")

    message = ChatMessage(
        room_id=room_id,
        user_id=user.id,
        content=content,
        type="text",
        reply_to=reply_to
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    db.add(ChatReadReceipt(message_id=message.id, user_id=user.id))
    db.commit()

    logger.info(f"[메시지 저장] ID: {message.id} | 방: {room_id} | 사용자: {user.id}")

    await broadcast_message(room_id, {
        "type": "message",
        "data": {
            "id": message.id,
            "room_id": message.room_id,
            "user_id": message.user_id,
            "user_name": user.name,
            "content": message.content,
            "type": "text",
            "file_id": None,
            "created_at": message.created_at.isoformat(),
            "read_by": []
        }
    })

async def handle_file_message(data: dict, user: User, room_id: str, websocket, db: Session):
    """파일 메시지 처리"""
    if not room_id:
        await websocket.send_json({"type": "error", "message": "채팅방에 입장하지 않음"})
        return

    file_id = data.get("file_id")
    metadata = data.get("metadata", {})

    chat_file = db.query(ChatFile).filter(ChatFile.id == file_id).first()
    if not chat_file:
        await websocket.send_json({"type": "error", "message": "파일 없음"})
        return

    message = ChatMessage(
        room_id=room_id,
        user_id=user.id,
        content=metadata.get("caption"),
        type="file",
        file_id=file_id
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    db.add(ChatReadReceipt(message_id=message.id, user_id=user.id))
    db.commit()

    chat_file.message_id = message.id
    db.commit()

    await broadcast_message(room_id, {
        "type": "message",
        "data": {
            "id": message.id,
            "room_id": message.room_id,
            "user_id": message.user_id,
            "user_name": user.name,
            "content": message.content,
            "type": "file",
            "file_id": file_id,
            "file_info": {
                "filename": chat_file.filename,
                "mime_type": chat_file.mime_type,
                "size": chat_file.size,
                "thumbnail": chat_file.thumbnail_path
            },
            "created_at": message.created_at.isoformat(),
            "read_by": []
        }
    })

async def broadcast_message(room_id: str, message: dict):
    """채팅방 멤버에게 메시지 브로드캐스트"""
    connections = await get_room_connections(room_id)
    logger.info(f"[broadcast_message] 방: {room_id} | 연결된 사용자: {list(connections.keys())}")

    for user_id, ws in connections.items():
        try:
            await ws.send_json(message)
            logger.info(f"[브로드캐스트 성공] 방: {room_id} | 사용자: {user_id}")
        except Exception as e:
            logger.error(f"[브로드캐스트 실패] 방: {room_id} | 사용자: {user_id} | {e}")

async def broadcast_typing(room_id: str, user_id: int, status: str):
    """타이핑 상태 브로드캐스트"""
    connections = await get_room_connections(room_id)

    for uid, ws in connections.items():
        if uid != user_id:
            try:
                await ws.send_json({
                    "type": "typing",
                    "data": {"user_id": user_id, "status": status}
                })
            except:
                pass

async def broadcast_read_receipt(room_id: str, read_data: dict):
    """읽음 확인 브로드캐스트"""
    connections = await get_room_connections(room_id)

    for user_id, ws in connections.items():
        try:
            await ws.send_json({
                "type": "read",
                "data": read_data
            })
        except:
            pass

async def handle_read(data: dict, user: User, room_id: str, db: Session):
    """읽음 확인 처리 (WebSocket 버전)"""
    message_ids = data.get("message_ids", [])

    member = db.query(ChatRoomMember).filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.user_id == user.id
    ).first()

    if member and message_ids:
        max_id = max(message_ids)
        if not member.last_read_id or max_id > member.last_read_id:
            member.last_read_id = max_id

        for msg_id in message_ids:
            existing = db.query(ChatReadReceipt).filter(
                ChatReadReceipt.message_id == msg_id,
                ChatReadReceipt.user_id == user.id
            ).first()
            if not existing:
                db.add(ChatReadReceipt(message_id=msg_id, user_id=user.id))

        db.commit()

        await broadcast_read_receipt(room_id, {
            "user_id": user.id,
            "message_ids": message_ids
        })

async def register_user_connection(user_id: int, websocket):
    if user_id not in user_connections:
        user_connections[user_id] = []
    if websocket not in user_connections[user_id]:
        user_connections[user_id].append(websocket)
    logger.info(f"[전역 연결 등록] 사용자: {user_id} | 연결 수: {len(user_connections[user_id])}")

async def unregister_user_connection(user_id: int, websocket):
    if user_id in user_connections:
        if websocket in user_connections[user_id]:
            user_connections[user_id].remove(websocket)
        if not user_connections[user_id]:
            del user_connections[user_id]
        logger.info(f"[전역 연결 해제] 사용자: {user_id}")

async def broadcast_to_users(user_ids: list, message: dict):
    logger.info(f"[브로드캐스트 시작] 대상: {user_ids} | user_connections: {list(user_connections.keys())}")
    for user_id in user_ids:
        if user_id in user_connections:
            logger.info(f"[브로드캐스트] 사용자 {user_id} | 연결 수: {len(user_connections[user_id])}")
            for ws in user_connections[user_id]:
                try:
                    await ws.send_json(message)
                    logger.info(f"[브로드캐스트 성공] 사용자: {user_id}")
                except Exception as e:
                    logger.error(f"[브로드캐스트 실패] 사용자: {user_id} | {e}")
        else:
            logger.warning(f"[브로드캐스트 건너뜀] 사용자 {user_id} 연결 없음")
