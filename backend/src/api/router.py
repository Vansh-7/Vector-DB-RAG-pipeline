from fastapi import APIRouter

from api.routers.auth import router as auth_router
from api.routers.conversations import router as conversation_router
from api.routes import router as core_router

router = APIRouter()

router.include_router(core_router)
router.include_router(auth_router)
router.include_router(conversation_router)
