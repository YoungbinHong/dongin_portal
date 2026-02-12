from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import asyncio
from jose import jwt
from auth import SECRET_KEY, ALGORITHM
from models import User, ChatRoomMember
from logger import logger
import chat_manager

async def authenticate_websocket(token: str, db: Session):
    """JWT 토큰으로 사용자 인증"""
    try:
        if token.startswith("Bearer "):
            token = token[7:]

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")

        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            return None
        return user
    except Exception as e:
        logger.error(f"[WebSocket 인증 실패] {e}")
        return None

async def heartbeat_monitor(websocket: WebSocket):
    """하트비트 모니터링 (30초 간격)"""
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except:
        pass

async def handle_websocket_chat(websocket: WebSocket, db: Session):
    """WebSocket 채팅 핸들러"""
    await websocket.accept()
    user = None
    current_room_id = None

    try:
        auth_timeout = asyncio.create_task(asyncio.sleep(10))
        receive_task = asyncio.create_task(websocket.receive_json())

        done, pending = await asyncio.wait(
            [auth_timeout, receive_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        for task in pending:
            task.cancel()

        if auth_timeout in done:
            await websocket.send_json({"type": "error", "message": "인증 시간 초과"})
            await websocket.close()
            return

        data = receive_task.result()
        if data.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "인증 필요"})
            await websocket.close()
            return

        user = await authenticate_websocket(data.get("token"), db)
        if not user:
            await websocket.send_json({"type": "error", "message": "인증 실패"})
            await websocket.close()
            return

        await websocket.send_json({"type": "auth_success", "user_id": user.id})
        await chat_manager.register_user_connection(user.id, websocket)

        heartbeat_task = asyncio.create_task(heartbeat_monitor(websocket))

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "pong":
                continue

            elif msg_type in ("join", "join_room"):
                room_id = data.get("room_id")
                logger.info(f"[join_room 요청] 사용자: {user.id} | 방: {room_id}")

                member = db.query(ChatRoomMember).filter(
                    ChatRoomMember.room_id == room_id,
                    ChatRoomMember.user_id == user.id
                ).first()
                if not member:
                    logger.warning(f"[join_room 실패] 사용자: {user.id} | 방: {room_id} | 권한 없음")
                    await websocket.send_json({"type": "error", "message": "권한 없음"})
                    continue

                if current_room_id:
                    await chat_manager.unregister_connection(current_room_id, user.id)

                current_room_id = room_id
                await chat_manager.register_connection(room_id, user.id, websocket)
                logger.info(f"[join_room 완료] 사용자: {user.id} | 방: {room_id}")
                await websocket.send_json({"type": "joined", "room_id": room_id})

            elif msg_type == "message":
                logger.info(f"[메시지 수신] 사용자: {user.id} | 방: {current_room_id}")
                await chat_manager.handle_message(data, user, current_room_id, websocket, db)

            elif msg_type == "file":
                await chat_manager.handle_file_message(data, user, current_room_id, websocket, db)

            elif msg_type == "typing":
                await chat_manager.broadcast_typing(current_room_id, user.id, data.get("status"))

            elif msg_type == "read":
                await chat_manager.handle_read(data, user, current_room_id, db)

    except WebSocketDisconnect:
        logger.info(f"[WebSocket 끊김] 사용자: {user.id if user else 'unknown'}")
    except Exception as e:
        logger.error(f"[WebSocket 오류] {e}", exc_info=True)
    finally:
        if user:
            await chat_manager.unregister_user_connection(user.id, websocket)
        if user and current_room_id:
            await chat_manager.unregister_connection(current_room_id, user.id)
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()
