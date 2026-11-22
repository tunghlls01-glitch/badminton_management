"""Run the application against a disposable private MySQL instance."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pymysql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "docs/testing/T3D1A53"
TZ = timezone(timedelta(hours=7))
NOW = lambda: datetime.now(TZ).isoformat(timespec="seconds")
MYSQL = Path(os.getenv("QA_MYSQLD", r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"))


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def wait_for(probe, process):
    for _ in range(100):
        if process.poll() is not None:
            break
        try:
            return probe()
        except (OSError, pymysql.MySQLError):
            time.sleep(.2)
    raise RuntimeError("Dịch vụ test không khởi động được.")


def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    started = NOW()
    run_id = datetime.now(TZ).strftime("%Y%m%d-%H%M%S-%f")
    commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    version_files = ["backend/app/schemas/user.py", "backend/app/routers/auth.py",
                     "frontend/js/pages/auth-page.js", "frontend/pages/profile.html"]
    revision = ", ".join(f"{Path(name).name} {hashlib.sha256((ROOT / name).read_bytes()).hexdigest()[:8]}"
                         for name in version_files)
    records = []
    processes = []
    frontend = None
    stage = "MySQL"
    error = ""
    with tempfile.TemporaryDirectory(prefix="t3d1a53-", ignore_cleanup_errors=True) as tmp:
        try:
            port, db_port = free_port(), free_port()
            data = Path(tmp) / "mysql"
            flags = [str(MYSQL), "--no-defaults", f"--datadir={data}"]
            subprocess.run([*flags, "--initialize-insecure", "--console"], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            mysql = subprocess.Popen([*flags, "--bind-address=127.0.0.1", f"--port={db_port}",
                                      "--mysqlx=OFF", "--skip-log-bin", "--console"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            processes.append(mysql)
            db_args = dict(host="127.0.0.1", port=db_port, user="root")
            db_password = secrets.token_hex(24)
            with wait_for(lambda: pymysql.connect(**db_args), mysql) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("CREATE DATABASE qa_t3d1a53 CHARACTER SET utf8mb4")
                    cursor.execute("SELECT VERSION()")
                    mysql_version = cursor.fetchone()[0]
                    cursor.execute("ALTER USER 'root'@'localhost' IDENTIFIED BY %s", (db_password,))
            db_args["password"] = db_password
            stage = "FastAPI"
            os.environ.update(DB_HOST="127.0.0.1", DB_PORT=str(db_port), DB_USER="root",
                              DB_PASSWORD=db_password, DB_NAME="qa_t3d1a53", CORS_ORIGINS="*",
                              SECRET_KEY=secrets.token_hex(32))
            sys.path.insert(0, str(ROOT / "backend"))
            from app import models
            from app.db.session import Base, engine
            from sqlalchemy.exc import SQLAlchemyError

            stage = "Schema MySQL"
            try:
                Base.metadata.create_all(engine)
            except SQLAlchemyError as exc:
                original = getattr(exc, "orig", None)
                raise RuntimeError(f"{type(exc).__name__}: {original}") from None
            stage = "FastAPI"
            base = f"http://127.0.0.1:{port}"
            api = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app",
                                    "--port", str(port), "--no-access-log"], cwd=ROOT / "backend",
                                   env=dict(os.environ), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            processes.append(api)
            with wait_for(lambda: urlopen(base + "/openapi.json", timeout=2), api) as response:
                assert "/api/admin/customers" in json.load(response)["paths"]
            with urlopen(base + "/api/health", timeout=5) as response:
                assert json.load(response)["database"] == "connected"

            def request(method, path, payload=None, token=None):
                headers = {"Content-Type": "application/json"}
                if token is not None:
                    headers["Authorization"] = "Bearer " + token
                req = Request(base + path, data=json.dumps(payload).encode() if payload is not None else None,
                              headers=headers, method=method)
                try:
                    response = urlopen(req, timeout=8)
                except HTTPError as exc:
                    response = exc
                with response:
                    return response.status, json.load(response)

            stage = "Dữ liệu và API"
            from api_cases import run_api
            records.extend(run_api(request))

            class Frontend(SimpleHTTPRequestHandler):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, directory=str(ROOT / "frontend"), **kwargs)

                def log_message(self, *args):
                    pass

                def do_GET(self):
                    if self.path == "/js/config.js":
                        body = (ROOT / "frontend/js/config.js").read_bytes().replace(
                            b"http://127.0.0.1:8000/api", (base + "/api").encode())
                        self.send_response(200)
                        self.send_header("Content-Type", "application/javascript")
                        self.end_headers()
                        self.wfile.write(body)
                    else:
                        try:
                            super().do_GET()
                        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                            # A page can navigate away while Edge is fetching an asset.
                            pass

            stage = "Trình duyệt"
            frontend = ThreadingHTTPServer(("127.0.0.1", 0), Frontend)
            Thread(target=frontend.serve_forever, daemon=True).start()
            ui_result = Path(tmp) / "ui.json"
            result = subprocess.run(["node", str(HERE / "browser.cjs"),
                                     f"http://127.0.0.1:{frontend.server_port}", str(ui_result)],
                                    cwd=ROOT, timeout=180, capture_output=True)
            if result.returncode:
                error = "Edge/Playwright không chạy được hoặc lần chạy UI bị gián đoạn."
            if ui_result.exists():
                records.extend(json.loads(ui_result.read_text(encoding="utf-8")))
        except (OSError, subprocess.SubprocessError, RuntimeError, pymysql.MySQLError, AssertionError) as exc:
            error = f"{stage}: {type(exc).__name__}."
            if stage == "Schema MySQL":
                error += " " + str(exc)
            if isinstance(exc, HTTPError):
                error += f" HTTP {exc.code}."
            if isinstance(exc, AssertionError):
                error += " " + str(exc)
        finally:
            if frontend:
                frontend.shutdown()
                frontend.server_close()
            if len(processes) and "db_args" in locals():
                try:
                    with pymysql.connect(**db_args, connect_timeout=2) as connection:
                        with connection.cursor() as cursor:
                            cursor.execute("SHUTDOWN")
                    processes[0].wait(15)
                except (pymysql.MySQLError, subprocess.TimeoutExpired):
                    pass
            for process in reversed(processes):
                stop(process)

    history = OUT / "runs.jsonl"
    with history.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(dict(id=run_id, started=started, finished=NOW(), commit=commit,
                                     revision=revision, mysql=locals().get("mysql_version", ""),
                                     error=error, records=records), ensure_ascii=False) + "\n")
    for row in records:
        print(row["id"], row["status"], row["actual"])
    if error:
        print(error)
    if "--no-export" not in sys.argv:
        subprocess.run(["node", str(HERE / "workbook.cjs")], cwd=ROOT, check=True)
    return int(bool(error) or any(row["status"] != "Pass" for row in records))


if __name__ == "__main__":
    sys.exit(main())
