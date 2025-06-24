import psutil
import time
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

class ResourceMonitorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        proc = psutil.Process()
        start_time = time.time()
        start_cpu = proc.cpu_times()
        start_mem = proc.memory_info().rss  # Resident Set Size in bytes
        proc.cpu_percent(interval=None)  # Initialize cpu_percent measurement

        response = await call_next(request)

        end_time = time.time()
        end_cpu = proc.cpu_times()
        end_mem = proc.memory_info().rss
        cpu_percent = proc.cpu_percent(interval=None)  # Get % CPU since last call

        duration = end_time - start_time
        cpu_used = (end_cpu.user - start_cpu.user) + (end_cpu.system - start_cpu.system)
        mem_used = end_mem - start_mem

        print(
            f"Request {request.method} {request.url.path} took {duration:.2f}s, "
            f"CPU: {cpu_used:.4f}s, CPU %: {cpu_percent:.2f}, Memory Change: {mem_used/1024:.2f} KB"
        )
        return response