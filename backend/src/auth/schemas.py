from datetime import datetime
from unicodedata import category

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def enforce_password_policy(cls, value: str) -> str:
        # Registration policy is authoritative here, independently of the UI.
        if not (
            any("A" <= char <= "Z" for char in value)
            and any("a" <= char <= "z" for char in value)
            and any("0" <= char <= "9" for char in value)
            and any(category(char).startswith(("P", "S")) for char in value)
        ):
            raise ValueError(
                "Password must contain an uppercase ASCII letter, a lowercase ASCII letter, "
                "a number, and a special character."
            )
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CurrentUserResponse(UserResponse):
    is_operator: bool
