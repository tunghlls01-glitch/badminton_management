"""Run: python -m unittest discover -s tests -v (from backend). No MySQL needed."""
import asyncio
import json
import unittest

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import Base, get_db
from app.models.user import User, UserRole, UserStatus
from app.routers import auth, profile


class ProfileAPITest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                                    poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        with self.sessions() as db:
            for index in (1, 2):
                db.add(User(id=index, full_name=f"User {index}",
                            email=f"user{index}@example.com", phone=f"090123456{index}",
                            hashed_password=get_password_hash("old-password"),
                            role=UserRole.CUSTOMER, status=UserStatus.ACTIVE))
            db.commit()
        self.app = FastAPI()
        self.app.include_router(auth.router)
        self.app.include_router(profile.router, prefix="/api")

        def override_db():
            with self.sessions() as db:
                yield db
        self.app.dependency_overrides[get_db] = override_db

    def tearDown(self):
        self.engine.dispose()

    def request(self, method, path, payload=None, user_id=1):
        async def run():
            body = json.dumps(payload).encode() if payload is not None else b""
            headers = [(b"content-type", b"application/json")]
            if user_id is not None:
                token = create_access_token({"sub": str(user_id)})
                headers.append((b"authorization", f"Bearer {token}".encode()))
            messages = []

            async def receive():
                return {"type": "http.request", "body": body, "more_body": False}

            async def send(message):
                messages.append(message)

            await self.app({"type": "http", "asgi": {"version": "3.0"},
                            "http_version": "1.1", "method": method, "scheme": "http",
                            "path": path, "raw_path": path.encode(), "query_string": b"",
                            "root_path": "", "headers": headers,
                            "server": ("test", 80), "client": ("test", 1)}, receive, send)
            status = next(m["status"] for m in messages if m["type"] == "http.response.start")
            content = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
            return status, json.loads(content)
        return asyncio.run(run())

    def test_authentication_required(self):
        for method, path in [("GET", "/api/profile"), ("PUT", "/api/profile"),
                             ("POST", "/auth/change-password")]:
            self.assertEqual(self.request(method, path, {}, user_id=None)[0], 401)
        with self.sessions() as db:
            db.get(User, 1).status = UserStatus.LOCKED
            db.commit()
        self.assertEqual(self.request("GET", "/api/profile")[0], 403)

    def test_profile_update_is_scoped_and_persisted(self):
        avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII="
        payload = {"full_name": " New Name ", "phone": "+84901234563", "avatar": avatar}
        status, data = self.request("PUT", "/api/profile", payload)
        self.assertEqual(status, 200)
        self.assertEqual(data, {**payload, "full_name": "New Name", "email": "user1@example.com"})
        self.assertEqual(self.request("GET", "/api/profile")[1], data)
        self.assertEqual(self.request("GET", "/api/profile", user_id=2)[1]["full_name"], "User 2")
        self.assertNotIn("hashed_password", data)
        self.assertEqual(self.request("PUT", "/api/profile", {"full_name": "A", "phone": "0901234563"})[1]["avatar"], avatar)

    def test_invalid_profile_and_readonly_fields(self):
        base = {"full_name": "Name", "phone": "0901234563"}
        for changes in [{"full_name": " "}, {"phone": "abc"}, {"email": "other@example.com"},
                        {"role": "ADMIN"}, {"avatar": "javascript:alert(1)"},
                        {"avatar": "data:image/png;base64,YWJj"}]:
            self.assertEqual(self.request("PUT", "/api/profile", {**base, **changes})[0], 422)
        self.assertEqual(self.request("PUT", "/api/profile", {**base, "phone": "0901234562"})[0], 409)
        self.assertEqual(self.request("GET", "/api/profile")[1]["full_name"], "User 1")

    def test_password_validation_and_hash_persistence(self):
        payload = {"old_password": "wrong", "new_password": "new-password", "confirm_password": "new-password"}
        self.assertEqual(self.request("POST", "/auth/change-password", payload)[0], 400)
        payload["old_password"] = "old-password"
        self.assertEqual(self.request("POST", "/auth/change-password", {**payload, "confirm_password": "different"})[0], 422)
        self.assertEqual(self.request("POST", "/auth/change-password", {**payload, "new_password": " ", "confirm_password": " "})[0], 422)
        self.assertEqual(self.request("POST", "/auth/change-password", {**payload, "new_password": "á" * 37, "confirm_password": "á" * 37})[0], 422)
        with self.sessions() as db:
            self.assertTrue(verify_password("old-password", db.get(User, 1).hashed_password))
        self.assertEqual(self.request("POST", "/auth/change-password", payload)[0], 200)
        with self.sessions() as db:
            stored = db.get(User, 1).hashed_password
            self.assertNotEqual(stored, "new-password")
            self.assertTrue(verify_password("new-password", stored))
            self.assertFalse(verify_password("old-password", stored))
            self.assertTrue(verify_password("old-password", db.get(User, 2).hashed_password))
        self.assertEqual(self.request("POST", "/auth/login", {"account": "user1@example.com", "password": "new-password"})[0], 200)
        self.assertEqual(self.request("POST", "/auth/login", {"account": "user1@example.com", "password": "old-password"})[0], 401)
